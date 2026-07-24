/**
 * ماژول تحلیل میدان دید (Viewshed) واقعی بر اساس پروفایل ارتفاعی زمین.
 *
 * روش محاسبه: از نقطه مرکز (ناظر) در امتداد ۳۶ راستا (هر ۱۰ درجه) تا شعاع تعریف‌شده
 * نمونه‌برداری ارتفاعی انجام و با روش «حداکثر زاویه تجمعی» (همراه با تصحیح انحنای زمین
 * و شکست جوی) وضعیت دیده‌شده/مسدود هر نمونه تعیین می‌شود.
 *
 * روش نمایش: به‌جای نشانگرهای پراکنده، یک لایه تصویری پیوسته (Raster) دقیقاً هم‌تراز با
 * مختصات جغرافیایی ساخته می‌شود (طیف رنگ سبز = قابل‌دید، قرمز = کور دید) و به‌عنوان یک
 * Image Overlay روی نقشه دو بعدی و یک ImageryLayer روی نقشه سه‌بعدی (که مستقیماً روی
 * بافت زمین/کره منطبق و با توپوگرافی سه‌بعدی محاط می‌شود) اعمال می‌گردد.
 */
import { attachExtra3DEntity, removeLinked3DEntities, onFreeClick2D, onGlobeClick3D } from '../map.js';

const EARTH_RADIUS = 6371000;
const REFRACTION_K = 0.13;   // ضریب شکست جوی استاندارد
const BEARING_COUNT = 36;    // هر ۱۰ درجه — نمونه‌برداری خط دید
const STEPS_PER_BEARING = 16;
const RASTER_SIZE = 320;     // ابعاد بوم تصویر لایه رنگی (پیکسل)

let currentViewshedAnchor = null;      // نشانگر مرکز (انکِر موجودیت‌های نقطه‌ای/گنبد سه‌بعدی)
let currentImageOverlay2D = null;      // لایه تصویری روی نقشه دو بعدی
let currentImageryLayer3D = null;      // لایه تصویری (Imagery Layer) روی نقشه سه‌بعدی

export function initAnalysisModule(map2D, viewer3D, drawnItems) {
    const btnBuffer = document.getElementById('btn-draw-buffer');
    const infoBox = document.getElementById('analysis-info-box');
    let waitingForClick = false;

    btnBuffer?.addEventListener('click', () => {
        waitingForClick = true;
        if (infoBox) infoBox.innerHTML = 'مرکز تحلیل میدان دید را روی نقشه (۲بعدی یا ۳بعدی) کلیک کنید...';
    });

    const trigger = async (lat, lng) => {
        if (!waitingForClick) return;
        waitingForClick = false;
        await runViewshed(lat, lng, map2D, viewer3D, drawnItems, infoBox);
    };

    onFreeClick2D((lat, lng) => trigger(lat, lng));
    onGlobeClick3D((lat, lng) => trigger(lat, lng));

    // اطمینان از پاک‌سازی کامل لایه تصویری سه‌بعدی هنگام «پاک‌سازی همه ترسیمات»
    // (لایه‌های تصویری Cesium در مجموعه entities قرار ندارند و باید جداگانه حذف شوند)
    document.getElementById('btn-clear-drawings')?.addEventListener('click', () => {
        clearPreviousViewshed(viewer3D, drawnItems);
    });
}

function clearPreviousViewshed(viewer3D, drawnItems) {
    if (currentViewshedAnchor) {
        removeLinked3DEntities(currentViewshedAnchor, viewer3D); // حذف نقطه مرکز + گنبد سه‌بعدی
        drawnItems.removeLayer(currentViewshedAnchor);
        currentViewshedAnchor = null;
    }
    if (currentImageOverlay2D) {
        drawnItems.removeLayer(currentImageOverlay2D);
        currentImageOverlay2D = null;
    }
    if (viewer3D && currentImageryLayer3D) {
        try { viewer3D.imageryLayers.remove(currentImageryLayer3D, true); } catch (e) { /* noop */ }
        currentImageryLayer3D = null;
    }
}

async function runViewshed(centerLat, centerLng, map2D, viewer3D, drawnItems, infoBox) {
    const radius = parseFloat(document.getElementById('input-buffer-radius').value) || 5000;
    const observerHeight = parseFloat(document.getElementById('input-viewshed-height').value) || 1.7;

    // فقط یک تحلیل میدان دید در آن واحد فعال است؛ تحلیل قبلی (از هر دو نقشه) پاک می‌شود
    clearPreviousViewshed(viewer3D, drawnItems);

    setInfo(infoBox, '<i class="fa-solid fa-spinner fa-spin"></i> در حال نمونه‌برداری پروفایل ارتفاعی زمین...');

    // شبکه نمونه‌برداری شعاعی: مرکز + (تعداد راستا × تعداد گام در هر راستا)
    const samplePoints = [{ lat: centerLat, lng: centerLng, bearingIdx: -1, stepIdx: 0, dist: 0 }];
    for (let b = 0; b < BEARING_COUNT; b++) {
        const bearingDeg = (360 / BEARING_COUNT) * b;
        for (let s = 1; s <= STEPS_PER_BEARING; s++) {
            const dist = (radius * s) / STEPS_PER_BEARING;
            const dest = destinationPoint(centerLat, centerLng, bearingDeg, dist);
            samplePoints.push({ lat: dest.lat, lng: dest.lng, bearingIdx: b, stepIdx: s, dist });
        }
    }

    let elevations;
    try {
        elevations = await fetchElevationsChunked(samplePoints, infoBox);
    } catch (err) {
        console.error('خطا در دریافت پروفایل ارتفاعی:', err);
        setInfo(infoBox, 'خطا در دریافت اطلاعات ارتفاعی سرویس Open-Meteo.');
        return;
    }

    setInfo(infoBox, '<i class="fa-solid fa-spinner fa-spin"></i> در حال محاسبه خط دید و رسم لایه...');

    const centerElev = elevations[0];
    const eyeElev = centerElev + observerHeight;

    // نگاشت شماره راستا → آرایه نمونه‌های آن راستا (به ترتیب فاصله از مرکز، از نزدیک به دور)
    const byBearing = Array.from({ length: BEARING_COUNT }, () => []);
    for (let i = 1; i < samplePoints.length; i++) {
        byBearing[samplePoints[i].bearingIdx].push({ dist: samplePoints[i].dist, elev: elevations[i] });
    }

    let visibleCount = 0, totalCount = 0;
    // visibilityGrid[bearingIdx][stepIdx-1] = true/false — برای نمونه‌برداری سریع هنگام رسترسازی
    const visibilityGrid = byBearing.map(chain => {
        let maxAngle = -Infinity;
        return chain.map(({ dist, elev }) => {
            const curvatureDrop = (dist * dist * (1 - 2 * REFRACTION_K)) / (2 * EARTH_RADIUS);
            const correctedElev = elev - curvatureDrop;
            const angle = (correctedElev - eyeElev) / Math.max(dist, 1);
            const visible = angle >= maxAngle - 1e-6;
            if (visible && angle > maxAngle) maxAngle = angle;
            totalCount++;
            if (visible) visibleCount++;
            return visible;
        });
    });

    const bounds = buildRasterAndOverlay(centerLat, centerLng, centerElev, observerHeight, radius, visibilityGrid, map2D, viewer3D, drawnItems);

    const pct = totalCount ? Math.round((visibleCount / totalCount) * 100) : 0;
    setInfo(infoBox, `✅ تحلیل میدان دید کامل شد — مرکز (${centerLat.toFixed(4)}, ${centerLng.toFixed(4)})، شعاع ${(radius / 1000).toFixed(2)} کیلومتر، ارتفاع ناظر ${observerHeight} متر.<br>` +
        `🟢 سطح قابل‌رؤیت: <b>${pct}%</b> — 🔴 سطح کور دید: <b>${100 - pct}%</b>` +
        (bounds ? '' : '<br><span style="color:#f59e0b;">⚠️ رسم لایه سه‌بعدی با خطا مواجه شد؛ نسخه دو بعدی در دسترس است.</span>'));
}

/** واکشی دسته‌ای ارتفاع نقاط از Open-Meteo (حداکثر ۹۰ نقطه در هر درخواست) */
async function fetchElevationsChunked(points, infoBox) {
    const CHUNK = 90;
    const results = new Array(points.length);
    const chunkCount = Math.ceil(points.length / CHUNK);

    for (let c = 0; c < chunkCount; c++) {
        const slice = points.slice(c * CHUNK, (c + 1) * CHUNK);
        const lats = slice.map(p => p.lat.toFixed(5)).join(',');
        const lngs = slice.map(p => p.lng.toFixed(5)).join(',');
        setInfo(infoBox, `<i class="fa-solid fa-spinner fa-spin"></i> دریافت پروفایل ارتفاعی... (${c + 1}/${chunkCount})`);

        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
        const data = await res.json();
        data.elevation.forEach((e, i) => { results[c * CHUNK + i] = e; });
    }
    return results;
}

/**
 * ساخت بوم رستری با طیف رنگ سبز/قرمز (منطبق دقیق بر مختصات جغرافیایی محدوده تحلیل)
 * و اعمال آن به‌عنوان لایه تصویری روی هر دو نقشه.
 */
function buildRasterAndOverlay(centerLat, centerLng, centerElev, observerHeight, radius, visibilityGrid, map2D, viewer3D, drawnItems) {
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos((centerLat * Math.PI) / 180);
    const dLat = radius / metersPerDegLat;
    const dLng = radius / metersPerDegLng;

    const south = centerLat - dLat, north = centerLat + dLat;
    const west = centerLng - dLng, east = centerLng + dLng;

    const canvas = document.createElement('canvas');
    canvas.width = RASTER_SIZE;
    canvas.height = RASTER_SIZE;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(RASTER_SIZE, RASTER_SIZE);

    const anglePerBearing = 360 / BEARING_COUNT;

    for (let py = 0; py < RASTER_SIZE; py++) {
        for (let px = 0; px < RASTER_SIZE; px++) {
            const idx = (py * RASTER_SIZE + px) * 4;

            // مختصات این پیکسل نسبت به مرکز، بر حسب متر (شرق/شمال)
            const fracX = px / RASTER_SIZE; // 0..1 از غرب به شرق
            const fracY = py / RASTER_SIZE; // 0..1 از شمال به جنوب
            const dxMeters = (fracX - 0.5) * 2 * dLng * metersPerDegLng;
            const dyMeters = (0.5 - fracY) * 2 * dLat * metersPerDegLat;
            const r = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);

            if (r > radius) {
                imageData.data[idx + 3] = 0; // بیرون از شعاع تحلیل: کاملاً شفاف
                continue;
            }

            let bearingDeg = (Math.atan2(dxMeters, dyMeters) * 180) / Math.PI;
            if (bearingDeg < 0) bearingDeg += 360;
            const bearingIdx = Math.round(bearingDeg / anglePerBearing) % BEARING_COUNT;

            const chain = visibilityGrid[bearingIdx];
            let visible = true;
            if (chain && chain.length) {
                let stepIdx = Math.round((r / radius) * STEPS_PER_BEARING) - 1;
                stepIdx = Math.max(0, Math.min(chain.length - 1, stepIdx));
                visible = chain[stepIdx];
            }

            if (visible) {
                imageData.data[idx] = 34; imageData.data[idx + 1] = 197; imageData.data[idx + 2] = 94; // سبز
            } else {
                imageData.data[idx] = 239; imageData.data[idx + 1] = 68; imageData.data[idx + 2] = 68; // قرمز
            }
            imageData.data[idx + 3] = 150; // نیمه‌شفاف تا بافت زیرین نقشه هم دیده شود
        }
    }

    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    // --- لایه تصویری روی نقشه دو بعدی (کاملاً منطبق بر مختصات جغرافیایی) ---
    currentImageOverlay2D = L.imageOverlay(dataUrl, L.latLngBounds([south, west], [north, east]), {
        opacity: 1,
        interactive: false
    }).addTo(drawnItems);

    // --- نشانگر مرکز (ناظر) - انکِر موجودیت‌های سه‌بعدی نقطه‌ای ---
    const centerMarker = L.circleMarker([centerLat, centerLng], {
        radius: 7, color: '#ffffff', weight: 2, fillColor: '#0284c7', fillOpacity: 1
    }).bindPopup(`<b><i class="fa-solid fa-eye"></i> مرکز ناظر</b><br>ارتفاع ناظر از زمین: ${observerHeight} متر<br>شعاع تحلیل: ${(radius / 1000).toFixed(2)} کیلومتر`)
      .addTo(drawnItems);
    currentViewshedAnchor = centerMarker;

    if (!viewer3D) return true;

    let ok = true;
    try {
        // --- لایه تصویری روی نقشه سه‌بعدی: مستقیماً روی بافت/توپوگرافی زمین محاط می‌شود ---
        const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
        const provider = new Cesium.SingleTileImageryProvider({ url: dataUrl, rectangle });
        currentImageryLayer3D = viewer3D.imageryLayers.addImageryProvider(provider);
    } catch (e) {
        console.warn('خطا در رسم لایه سه‌بعدی میدان دید:', e);
        ok = false;
    }

    // نقطه مرکز در سه‌بعدی
    attachExtra3DEntity(centerMarker, viewer3D.entities.add({
        name: 'مرکز ناظر (Viewshed)',
        position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, centerElev + observerHeight),
        point: { pixelSize: 12, color: Cesium.Color.fromCssColorString('#0284c7'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        description: `<div style="direction:rtl;">مرکز ناظر — ارتفاع ${observerHeight}m از زمین، شعاع تحلیل ${(radius / 1000).toFixed(2)}km</div>`
    }));

    // گنبد نیمه‌شفاف: بافر دید/برد سه‌بعدی حسگر مرکزی به شعاع تحلیل (محاط بر همان کره)
    attachExtra3DEntity(centerMarker, viewer3D.entities.add({
        name: 'بافر دید سه‌بعدی (برد حسگر مرکزی)',
        position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, centerElev + observerHeight),
        ellipsoid: {
            radii: new Cesium.Cartesian3(radius, radius, radius * 0.6),
            minimumClock: 0,
            maximumClock: Cesium.Math.toRadians(360),
            minimumCone: 0,
            maximumCone: Cesium.Math.toRadians(90),
            material: Cesium.Color.CYAN.withAlpha(0.10),
            outline: true,
            outlineColor: Cesium.Color.CYAN.withAlpha(0.55)
        }
    }));

    return ok;
}

/** محاسبه مختصات مقصد از یک نقطه مبدأ با زاویه (بیرینگ) و فاصله مشخص (فرمول کروی) */
function destinationPoint(lat, lng, bearingDeg, distanceMeters) {
    const δ = distanceMeters / EARTH_RADIUS;
    const θ = (bearingDeg * Math.PI) / 180;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lng * Math.PI) / 180;

    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

    return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}

function setInfo(infoBox, html) {
    if (infoBox) infoBox.innerHTML = html;
}
