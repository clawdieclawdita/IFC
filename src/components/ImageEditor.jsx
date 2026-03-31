import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_CROP = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
const MIN_CROP_BOX_PERCENT = 10;

const clampCropPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(90, Math.round(numeric)));
};

const normalizeRotation = (value) => {
  const numeric = Number(value) || 0;
  return ((numeric % 360) + 360) % 360;
};

const normalizeCrop = (crop = DEFAULT_CROP) => {
  const next = {
    top: clampCropPercent(crop.top),
    right: clampCropPercent(crop.right),
    bottom: clampCropPercent(crop.bottom),
    left: clampCropPercent(crop.left),
  };

  if (next.left + next.right > 90) {
    const overflow = next.left + next.right - 90;
    if (next.right >= overflow) next.right -= overflow;
    else next.left = Math.max(0, next.left - (overflow - next.right));
  }

  if (next.top + next.bottom > 90) {
    const overflow = next.top + next.bottom - 90;
    if (next.bottom >= overflow) next.bottom -= overflow;
    else next.top = Math.max(0, next.top - (overflow - next.bottom));
  }

  return next;
};

const getBoundsFromCrop = (crop) => ({
  left: crop.left,
  top: crop.top,
  right: 100 - crop.right,
  bottom: 100 - crop.bottom,
});

const getCropFromBounds = (bounds) => normalizeCrop({
  top: bounds.top,
  right: 100 - bounds.right,
  bottom: 100 - bounds.bottom,
  left: bounds.left,
});

const clampBounds = (bounds) => {
  const min = MIN_CROP_BOX_PERCENT;
  const left = Math.max(0, Math.min(100 - min, bounds.left));
  const top = Math.max(0, Math.min(100 - min, bounds.top));
  const right = Math.max(left + min, Math.min(100, bounds.right));
  const bottom = Math.max(top + min, Math.min(100, bounds.bottom));

  return {
    left,
    top,
    right,
    bottom,
  };
};

export default function ImageEditor({ file, initialMode = 'rotate', onClose, onSave }) {
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [activeSection, setActiveSection] = useState(initialMode);
  const [src, setSrc] = useState('');
  const [cropSurfaceRect, setCropSurfaceRect] = useState(null);
  const [imageNaturalSize, setImageNaturalSize] = useState(null);
  const cropAreaRef = useRef(null);
  const previewFrameRef = useRef(null);
  const previewImageRef = useRef(null);
  const dragStateRef = useRef(null);
  const activePointerIdRef = useRef(null);

  useEffect(() => {
    if (!file) return undefined;

    setRotation(normalizeRotation(file.rotation));
    setCrop(normalizeCrop(file.crop));
    setActiveSection(initialMode);
    setImageNaturalSize(null);

    if (!file.type?.startsWith('image/')) return undefined;
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, initialMode]);

  const previewScale = useMemo(() => {
    if (!imageNaturalSize || !previewFrameRef.current) return 1;

    const availableWidth = Math.max(previewFrameRef.current.clientWidth - 32, 1);
    const availableHeight = Math.max(previewFrameRef.current.clientHeight - 32, 1);
    const baseScale = Math.min(
      availableWidth / imageNaturalSize.width,
      availableHeight / imageNaturalSize.height,
      1,
    );

    const fittedWidth = imageNaturalSize.width * baseScale;
    const fittedHeight = imageNaturalSize.height * baseScale;
    const swapsAxes = rotation % 180 !== 0;

    if (!swapsAxes) return 1;

    return Math.min(
      availableWidth / fittedHeight,
      availableHeight / fittedWidth,
      1,
    );
  }, [imageNaturalSize, rotation]);

  useEffect(() => {
    const syncCropSurfaceRect = () => {
      const containerRect = cropAreaRef.current?.parentElement?.getBoundingClientRect();
      const imageRect = previewImageRef.current?.getBoundingClientRect();

      if (!containerRect || !imageRect || imageRect.width === 0 || imageRect.height === 0) {
        setCropSurfaceRect(null);
        return;
      }

      setCropSurfaceRect({
        width: imageRect.width,
        height: imageRect.height,
        left: imageRect.left - containerRect.left,
        top: imageRect.top - containerRect.top,
      });
    };

    syncCropSurfaceRect();

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => syncCropSurfaceRect())
      : null;

    if (resizeObserver) {
      if (cropAreaRef.current) resizeObserver.observe(cropAreaRef.current);
      if (previewImageRef.current) resizeObserver.observe(previewImageRef.current);
      if (previewFrameRef.current) resizeObserver.observe(previewFrameRef.current);
    }

    window.addEventListener('resize', syncCropSurfaceRect);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncCropSurfaceRect);
    };
  }, [previewScale, rotation, src]);

  useEffect(() => {
    const updateFromPoint = (clientX, clientY) => {
      const dragState = dragStateRef.current;
      const rect = cropAreaRef.current?.getBoundingClientRect();
      if (!dragState || !rect || rect.width === 0 || rect.height === 0) return;

      const nextX = ((clientX - rect.left) / rect.width) * 100;
      const nextY = ((clientY - rect.top) / rect.height) * 100;
      const deltaX = nextX - dragState.startPoint.x;
      const deltaY = nextY - dragState.startPoint.y;
      const nextBounds = { ...dragState.startBounds };

      if (dragState.handle.includes('n')) nextBounds.top += deltaY;
      if (dragState.handle.includes('s')) nextBounds.bottom += deltaY;
      if (dragState.handle.includes('w')) nextBounds.left += deltaX;
      if (dragState.handle.includes('e')) nextBounds.right += deltaX;

      setCrop(getCropFromBounds(clampBounds(nextBounds)));
    };

    const stopDragging = () => {
      dragStateRef.current = null;
      activePointerIdRef.current = null;
      document.body.style.userSelect = '';
    };

    const handlePointerMove = (event) => {
      if (!dragStateRef.current) return;
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      event.preventDefault();
      updateFromPoint(event.clientX, event.clientY);
    };

    const handlePointerUp = (event) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      stopDragging();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      stopDragging();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const cropBounds = useMemo(() => getBoundsFromCrop(crop), [crop]);

  if (!file) return null;

  const beginHandleDrag = (handle, clientX, clientY, pointerId, currentTarget) => {
    const rect = cropAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    dragStateRef.current = {
      handle,
      startPoint: {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      },
      startBounds: { ...cropBounds },
    };
    activePointerIdRef.current = pointerId;
    document.body.style.userSelect = 'none';
    currentTarget?.setPointerCapture?.(pointerId);
  };

  const handlePointerDown = (handle, event) => {
    event.preventDefault();
    event.stopPropagation();
    beginHandleDrag(handle, event.clientX, event.clientY, event.pointerId, event.currentTarget);
  };

  return (
    <div className="image-editor-modal" role="presentation">
      <div className="image-editor-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="image-editor-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-editor-title"
      >
        <div className="image-editor-modal__header">
          <div>
            <p className="image-editor-modal__eyebrow">Image editor</p>
            <h2 id="image-editor-title">Edit Image: {file.name}</h2>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close image editor">
            ✕
          </button>
        </div>

        <div className="image-editor-modal__body">
          <div className="image-editor-modal__preview-panel">
            <div className="image-editor-modal__preview-frame" ref={previewFrameRef}>
              <div className="image-preview-stack image-preview-stack--editor">
                <img
                  ref={previewImageRef}
                  src={src}
                  alt={file.name}
                  draggable="false"
                  onLoad={() => {
                    const image = previewImageRef.current;
                    const containerRect = cropAreaRef.current?.parentElement?.getBoundingClientRect();
                    const imageRect = image?.getBoundingClientRect();

                    if (image?.naturalWidth && image?.naturalHeight) {
                      setImageNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
                    }

                    if (!containerRect || !imageRect || imageRect.width === 0 || imageRect.height === 0) return;
                    setCropSurfaceRect({
                      width: imageRect.width,
                      height: imageRect.height,
                      left: imageRect.left - containerRect.left,
                      top: imageRect.top - containerRect.top,
                    });
                  }}
                  onDragStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  style={{
                    transform: `rotate(${rotation}deg) scale(${previewScale})`,
                    transformOrigin: 'center center',
                  }}
                />
                <div
                  ref={cropAreaRef}
                  className="image-editor-modal__crop-surface"
                  role="group"
                  aria-label={`Crop controls for ${file.name}`}
                  style={{
                    touchAction: 'none',
                    width: cropSurfaceRect?.width ?? 0,
                    height: cropSurfaceRect?.height ?? 0,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    visibility: cropSurfaceRect ? 'visible' : 'hidden',
                  }}
                >
                  <div className="crop-overlay crop-overlay--interactive" aria-hidden="true">
                    <div
                      className="crop-overlay__frame crop-overlay__frame--interactive"
                      style={{
                        inset: `${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%`,
                      }}
                    >
                      {['nw', 'ne', 'se', 'sw'].map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          className={`crop-handle crop-handle--${handle}`}
                          data-handle={handle}
                          aria-label={`Adjust crop ${handle.toUpperCase()} corner`}
                          onPointerDown={(event) => handlePointerDown(handle, event)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="image-editor-modal__controls">
            <div className="image-editor-modal__tabs" role="tablist" aria-label="Editor sections">
              <button
                type="button"
                className={`image-editor-modal__tab ${activeSection === 'rotate' ? 'image-editor-modal__tab--active' : ''}`}
                onClick={() => setActiveSection('rotate')}
              >
                ↻ Rotation
              </button>
              <button
                type="button"
                className={`image-editor-modal__tab ${activeSection === 'crop' ? 'image-editor-modal__tab--active' : ''}`}
                onClick={() => setActiveSection('crop')}
              >
                ✂️ Crop
              </button>
            </div>

            <section className={`image-editor-modal__section ${activeSection === 'rotate' ? 'is-active' : ''}`}>
              <div className="image-editor-modal__section-header">
                <h3>Rotation Controls</h3>
                <span className="rotation-readout">{rotation}°</span>
              </div>
              <div className="rotation-controls" role="group" aria-label={`Rotation controls for ${file.name}`}>
                <button type="button" className="chip-button" onClick={() => setRotation((current) => normalizeRotation(current - 90))}>
                  ↺ 90°
                </button>
                <button type="button" className="chip-button" onClick={() => setRotation(180)}>
                  180°
                </button>
                <button type="button" className="chip-button" onClick={() => setRotation((current) => normalizeRotation(current + 90))}>
                  ↻ 90°
                </button>
              </div>
            </section>

            <section className={`image-editor-modal__section ${activeSection === 'crop' ? 'is-active' : ''}`}>
              <div className="image-editor-modal__section-header">
                <h3>Crop Selection</h3>
                <span className="image-editor-modal__crop-readout">{crop.top}/{crop.right}/{crop.bottom}/{crop.left}%</span>
              </div>
              <p className="image-editor-modal__crop-help">
                Drag the corner handles on the image to choose the crop area. Values update automatically.
              </p>
            </section>
          </div>
        </div>

        <div className="image-editor-modal__footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onSave(file, { rotation, crop })}
          >
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}
