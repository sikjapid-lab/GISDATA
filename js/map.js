/* js/map.js
 * هسته اصلی نقشه: راه‌اندازی نقشه دو بعدی (Leaflet) و سه بعدی (Cesium)،
 * همگام‌سازی دقیق دوربین بر اساس محدوده جغرافیایی (Bounds)،
 * انتخاب مستقل نقشه پایه برای هر پنل، و ابزار عمومی اتصال نمادها بین دو پنل.
 */

let chartInstance = null;
let profileHoverMarker2D = null;
let profileHoverEntity3D = null;

// نگاشت لایه‌های ترسیمی (خط/چندضلعی/دایره) به موجودیت‌های سه‌بعدی متناظرشان
const layerTo3DEntities = new Map();
// نگاشت عمومی برای اتصال نمادهای دو نقشه (هواشناسی/زلزله/مسیر/پروفایل) جهت هم‌رویداد کردن کلیک‌ها
const entityToMarker2D = new Map();
// شنوندگان کلیک روی نقاط «آزاد» کره سه‌بعدی (بدون نماد) - مثلاً برای پرس‌وجوی هواشناسی با کلیک
const globeClickCallbacks = [];
// شنوندگان کلیک روی نقاط «آزاد» نقشه دو بعدی (بدون لایه‌ای زیر مکان‌نما) - برای حوادث ترافیکی و ...
const map2DFreeClickCallbacks = [];

let currentSyncMode = 'split';

/**
 * ۱۳ نقشه پایه رایگان و بدون نیاز به کلید/ثبت‌نام، قابل انتخاب مستقل برای هر پنل.
 */
const BASE_MAP_SOURCES = {
    "osm": { name: "OpenStreetMap", url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options: { maxZoom: 19 } },
    "opentopo": { name: "OpenTopoMap (توپوگرافی)", url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', options: { maxZoom: 17, subdomains: 'abc' } },
    "carto-voyager": { name: "CartoDB Voyager", url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', options: { maxZoom: 20, subdomains: 'abcd' } },
    "carto-positron": { name: "CartoDB Positron (روشن)", url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', options: { maxZoom: 20, subdomains: 'abcd' } },
    "carto-dark": { name: "CartoDB Dark Matter", url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', options: { maxZoom: 20, subdomains: 'abcd' } },
    "esri-sat": { name: "Esri World Imagery", url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 20 } },
    "esri-topo": { name: "Esri World Topo Map", url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 19 } },
    "esri-street": { name: "Esri World Street Map", url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 19 } },
    "esri-natgeo": { name: "Esri National Geographic", url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 16 } },
    "esri-ocean": { name: "Esri Ocean Basemap", url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 16 } },
    "google-sat": { name: "گوگل ماهواره‌ای (Satellite)", url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', options: { maxZoom: 21 } },
    "google-hybrid": { name: "گوگل هیبرید (Hybrid)", url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', options: { maxZoom: 21 } },
    "google-street": { name: "گوگل خیابانی (Streets)", url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', options: { maxZoom: 21 } },
    "google-terrain": { name: "گوگل توپوگرافی (Terrain)", url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', options: { maxZoom: 21 } },
    "osm-hot": { name: "OSM Humanitarian (HOT)", url: 'https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', options: { maxZoom: 20, subdomains: 'ab' } }
};

export function initMap() {
    // ساخت لایه‌های ۲بعدی برای همه نقشه‌های پایه
    Object.keys(BASE_MAP_SOURCES).forEach(key => {
        BASE_MAP_SOURCES[key].layer2D = L.tileLayer(BASE_MAP_SOURCES[key].url, BASE_MAP_SOURCES[key].options);
    });

    const map2D = L.map('map-2d', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [BASE_MAP_SOURCES["google-sat"].layer2D]
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map2D);

    // ---------------------------------------------------------------------
    // راه‌اندازی سه‌بعدی Cesium
    // ---------------------------------------------------------------------
    let viewer3D = null;
    let current3DImageryLayer = null;

    if (typeof Cesium !== 'undefined') {
        try {
            const savedIonToken = localStorage.getItem('apiCesiumIon') || '';
            if (savedIonToken) Cesium.Ion.defaultAccessToken = savedIonToken;

            viewer3D = new Cesium.Viewer('map-3d', {
                animation: false,
                timeline: false,
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                fullscreenButton: false,
                infoBox: true,
                selectionIndicator: true,
                baseLayer: false
            });

            current3DImageryLayer = viewer3D.imageryLayers.addImageryProvider(
                new Cesium.UrlTemplateImageryProvider({ url: BASE_MAP_SOURCES["google-sat"].url, maximumLevel: 20 })
            );

            setupTerrain(viewer3D, savedIonToken);
            setupGlobalEntityPicker(viewer3D, map2D);
            applySyncCameraConstraints(viewer3D, currentSyncMode);

        } catch (e) {
            console.warn("خطا در بارگذاری Cesium 3D:", e);
            viewer3D = null;
        }
    }

    // ---------------------------------------------------------------------
    // همگام‌سازی دقیق دوربین بر اساس محدوده (Bounds) - فقط در حالت «همزمان»
    // نکته فنی مهم: دوربین سه‌بعدی هنگام سینک به‌صورت عمودی (Nadir/Top-down) قفل می‌شود
    // زیرا در حالت متمایل (Tilt)، محاسبه محدوده دید واقعی (computeViewRectangle) نادقیق و
    // بزرگ‌تر از ناحیه واقعی دیده‌شده برمی‌گردد و باعث عدم تطابق زوم دو نقشه می‌شد.
    // یک پرچم مشترک (به‌جای دو قفل جداگانه) استفاده می‌شود تا هر جهتِ سینک، هر جهت دیگر را
    // در حین اجرای خودش مسدود کند؛ همچنین پیش از هر تلاش سینک، بررسی می‌شود که آیا دو نقشه
    // از قبل تقریباً هم‌تراز هستند یا نه، تا فراخوانی‌های تکراری/برگشتی بی‌اثر بمانند.
    // ---------------------------------------------------------------------
    let syncing = false;

    function rectsRoughlyMatch(bounds2D, rect3D) {
        if (!rect3D) return false;
        const w3 = Cesium.Math.toDegrees(rect3D.west), e3 = Cesium.Math.toDegrees(rect3D.east);
        const s3 = Cesium.Math.toDegrees(rect3D.south), n3 = Cesium.Math.toDegrees(rect3D.north);
        if (![w3, e3, s3, n3].every(isFinite)) return false;
        const span = Math.max(bounds2D.getEast() - bounds2D.getWest(), 0.0001);
        const tol = span * 0.03; // ۳٪ تلورانس
        return Math.abs(bounds2D.getWest() - w3) < tol && Math.abs(bounds2D.getEast() - e3) < tol &&
               Math.abs(bounds2D.getSouth() - s3) < tol && Math.abs(bounds2D.getNorth() - n3) < tol;
    }

    function sync2DTo3D() {
        if (currentSyncMode !== 'split' || !viewer3D || syncing) return;
        const b = map2D.getBounds();
        let rect3DNow = null;
        try { rect3DNow = viewer3D.camera.computeViewRectangle(); } catch (e) { /* noop */ }
        if (rectsRoughlyMatch(b, rect3DNow)) return; // از قبل هم‌تراز است؛ کاری لازم نیست

        const west = b.getWest(), east = b.getEast(), south = b.getSouth(), north = b.getNorth();
        if (!(isFinite(west) && isFinite(east) && isFinite(south) && isFinite(north)) || east <= west || north <= south) return;

        syncing = true;
        try {
            const rect = Cesium.Rectangle.fromDegrees(west, south, east, north);
            viewer3D.camera.setView({ destination: rect });
        } catch (e) {
            console.warn('همگام‌سازی ۲بعدی→۳بعدی ناموفق بود:', e);
        }
        setTimeout(() => { syncing = false; }, 350);
    }

    function sync3DTo2D() {
        if (currentSyncMode !== 'split' || !viewer3D || syncing) return;
        try {
            const rect = viewer3D.camera.computeViewRectangle();
            if (!rect) return;
            const sw = [Cesium.Math.toDegrees(rect.south), Cesium.Math.toDegrees(rect.west)];
            const ne = [Cesium.Math.toDegrees(rect.north), Cesium.Math.toDegrees(rect.east)];
            if (!(sw.every(isFinite) && ne.every(isFinite)) || ne[0] <= sw[0] || ne[1] <= sw[1]) return;
            if (rectsRoughlyMatch(map2D.getBounds(), rect)) return; // از قبل هم‌تراز است

            syncing = true;
            map2D.fitBounds(L.latLngBounds(sw, ne), { animate: false });
        } catch (e) {
            console.warn('همگام‌سازی ۳بعدی→۲بعدی ناموفق بود:', e);
        }
        setTimeout(() => { syncing = false; }, 350);
    }

    map2D.on('moveend zoomend', sync2DTo3D);
    if (viewer3D) {
        viewer3D.camera.moveEnd.addEventListener(sync3DTo2D);
        // چند تلاش همگام‌سازی اولیه (بارگذاری کند فونت/کاشی‌ها می‌تواند اندازه واقعی ظرف‌ها را با تأخیر تثبیت کند)
        [400, 900, 1800].forEach(delay => setTimeout(() => { map2D.invalidateSize(); sync2DTo3D(); }, delay));
    }
    window.addEventListener('load', () => {
        map2D.invalidateSize();
        if (viewer3D && viewer3D.resize) viewer3D.resize();
        setTimeout(sync2DTo3D, 200);
    });

    /** تغییر حالت نمایش (۲بعدی/همزمان/۳بعدی): در حالت غیرِ همزمان، دوربین سه‌بعدی آزاد می‌شود */
    function setSyncMode(mode) {
        currentSyncMode = mode;
        if (viewer3D) applySyncCameraConstraints(viewer3D, mode);
        if (mode === 'split') setTimeout(sync2DTo3D, 250);
    }

    // ---------------------------------------------------------------------
    // لایه‌های حمایتی: مرزهای بین‌المللی و اسامی مکان‌ها (روی هر دو نقشه)
    // ---------------------------------------------------------------------
    setupSupportLayers(map2D, viewer3D);

    // ---------------------------------------------------------------------
    // لایه عوارض ترسیمی + ابزار رسم
    // ---------------------------------------------------------------------
    const drawnItems = new L.FeatureGroup();
    map2D.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polyline: { metric: true },
            polygon: { showArea: true },
            circle: true,
            rectangle: true,
            marker: true,
            circlemarker: false
        },
        edit: { featureGroup: drawnItems }
    });
    map2D.addControl(drawControl);

    document.getElementById('btn-draw-polyline')?.addEventListener('click', () => {
        new L.Draw.Polyline(map2D, drawControl.options.draw.polyline).enable();
    });
    document.getElementById('btn-draw-polygon')?.addEventListener('click', () => {
        new L.Draw.Polygon(map2D, drawControl.options.draw.polygon).enable();
    });

    map2D.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        registerDrawnLayer(layer, e.layerType, viewer3D);
        updateMeasureOutput(layer, e.layerType);
    });

    map2D.on(L.Draw.Event.EDITED, (e) => {
        e.layers.eachLayer((layer) => {
            removeLinked3DEntities(layer, viewer3D);
            const layerType = layer instanceof L.Circle ? 'circle'
                : layer instanceof L.Polygon ? 'polygon'
                : layer instanceof L.Polyline ? 'polyline'
                : layer instanceof L.Marker ? 'marker' : null;
            registerDrawnLayer(layer, layerType, viewer3D);
        });
    });

    map2D.on(L.Draw.Event.DELETED, (e) => {
        e.layers.eachLayer((layer) => removeLinked3DEntities(layer, viewer3D));
    });

    // کلیک آزاد روی نقشه ۲بعدی (بدون تعامل با یک لایه)؛ برای حوادث ترافیکی و مشابه آن
    map2D.on('click', (e) => {
        map2DFreeClickCallbacks.forEach(cb => cb(e.latlng.lat, e.latlng.lng));
    });

    // پاک‌سازی همه‌ی ترسیمات (۲بعدی و متناظر سه‌بعدی) - نمادها و پروفایل نیز حذف می‌شوند
    document.getElementById('btn-clear-drawings')?.addEventListener('click', () => {
        drawnItems.eachLayer((layer) => removeLinked3DEntities(layer, viewer3D));
        drawnItems.clearLayers();
        closeElevationProfile(map2D, viewer3D);
        const out = document.getElementById('measure-output');
        if (out) out.innerHTML = 'نتایج محاسبه مساحت و محیط در اینجا درج خواهد شد.';
        const analysisBox = document.getElementById('analysis-info-box');
        if (analysisBox) analysisBox.innerHTML = '';
    });

    // ثبت رویدادهای پروفایل ارتفاعی
    document.getElementById('btn-elevation-profile')?.addEventListener('click', () => {
        let targetLine = null;
        drawnItems.eachLayer((layer) => {
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                targetLine = layer;
            }
        });

        if (!targetLine) {
            alert("لطفاً ابتدا یک مسیر (Polyline) با ابزار رسم روی نقشه ترسیم کنید.");
            return;
        }

        generateAdaptiveElevationProfile(targetLine, map2D, viewer3D);
    });

    document.getElementById('btn-close-elevation')?.addEventListener('click', () => {
        closeElevationProfile(map2D, viewer3D);
    });

    setupBaseMapPicker({
        selectId: 'select-base-map-2d', toggleId: 'btn-base-map-toggle-2d', dropdownId: 'base-map-dropdown-2d',
        initialKey: 'google-sat',
        applyFn: (key) => {
            Object.keys(BASE_MAP_SOURCES).forEach(k => map2D.removeLayer(BASE_MAP_SOURCES[k].layer2D));
            map2D.addLayer(BASE_MAP_SOURCES[key].layer2D);
        }
    });

    setupBaseMapPicker({
        selectId: 'select-base-map-3d', toggleId: 'btn-base-map-toggle-3d', dropdownId: 'base-map-dropdown-3d',
        initialKey: 'google-sat',
        applyFn: (key) => {
            if (!viewer3D) return;
            viewer3D.imageryLayers.removeAll();
            current3DImageryLayer = viewer3D.imageryLayers.addImageryProvider(
                new Cesium.UrlTemplateImageryProvider({ url: BASE_MAP_SOURCES[key].url, maximumLevel: 20 })
            );
        }
    });

    // به‌روزرسانی مختصات موش‌واره
    map2D.on('mousemove', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('coord-dd').innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
        document.getElementById('coord-dms').innerText = toDMS(lat, lng);
        const utm = convertLatLngToUTM(lat, lng);
        document.getElementById('coord-utm').innerText = `Z${utm.zone}${utm.hemisphere} | E:${Math.round(utm.easting)} N:${Math.round(utm.northing)}`;
    });

    return { map2D, viewer3D, drawnItems, setSyncMode, forceResync: sync2DTo3D };
}

/** قفل کردن نمای دوربین سه‌بعدی روی حالت عمودی (Nadir) هنگام همگام‌سازی، برای تطابق دقیق با نقشه ۲بعدی */
function applySyncCameraConstraints(viewer3D, mode) {
    const controller = viewer3D.scene.screenSpaceCameraController;
    if (mode === 'split') {
        controller.enableTilt = false;
        controller.enableLook = false;
        // بازنشانی به نمای کاملاً عمودی رو به پایین
        const carto = Cesium.Cartographic.fromCartesian(viewer3D.camera.position);
        viewer3D.camera.setView({
            destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
        });
    } else {
        controller.enableTilt = true;
        controller.enableLook = true;
    }
}

/**
 * ثبت‌کننده عمومی کلیک روی موجودیت‌های سه‌بعدی: هر موجودیتی که پیش‌تر با
 * linkMarkerAndEntity به یک نشانگر ۲بعدی متصل شده باشد، با کلیک روی آن در پنل
 * سه‌بعدی، پاپ‌آپ نشانگر متناظر در پنل دو بعدی نیز باز و به آن پن می‌شود.
 */
function setupGlobalEntityPicker(viewer3D, map2D) {
    viewer3D.screenSpaceEventHandler.setInputAction((movement) => {
        const picked = viewer3D.scene.pick(movement.position);
        if (picked && picked.id && entityToMarker2D.has(picked.id)) {
            const marker2D = entityToMarker2D.get(picked.id);
            if (marker2D) {
                if (typeof marker2D.getLatLng === 'function') {
                    map2D.panTo(marker2D.getLatLng());
                } else if (typeof marker2D.getBounds === 'function') {
                    map2D.fitBounds(marker2D.getBounds(), { maxZoom: 14 });
                } else if (typeof marker2D.getCenter === 'function') {
                    map2D.panTo(marker2D.getCenter());
                }
                if (typeof marker2D.openPopup === 'function') marker2D.openPopup();
            }
            return;
        }
        if (!globeClickCallbacks.length) return;
        try {
            const cartesian = viewer3D.camera.pickEllipsoid(movement.position, viewer3D.scene.globe.ellipsoid);
            if (cartesian) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const lat = Cesium.Math.toDegrees(cartographic.latitude);
                const lng = Cesium.Math.toDegrees(cartographic.longitude);
                globeClickCallbacks.forEach(cb => cb(lat, lng));
            }
        } catch (e) { /* noop */ }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

/** ثبت شنونده کلیک روی نقاط آزاد کره سه‌بعدی (بدون نماد از پیش موجود) */
export function onGlobeClick3D(callback) {
    globeClickCallbacks.push(callback);
}

/** ثبت شنونده کلیک آزاد روی نقشه دو بعدی (بدون تعامل با یک لایه خاص) */
export function onFreeClick2D(callback) {
    map2DFreeClickCallbacks.push(callback);
}

/**
 * اتصال دوطرفه یک نشانگر ۲بعدی به موجودیت سه‌بعدی متناظر آن.
 */
export function linkMarkerAndEntity(marker2D, entity3D, viewer3D) {
    if (!marker2D || !entity3D) return;
    if (viewer3D) entityToMarker2D.set(entity3D, marker2D);
    marker2D.on('click', () => {
        if (viewer3D) {
            viewer3D.selectedEntity = entity3D;
            viewer3D.flyTo(entity3D, { duration: 1.2 }).catch(() => {});
        }
    });
}

/** حذف اتصال یک موجودیت از نگاشت عمومی (هنگام پاک‌سازی لایه‌ها لازم است) */
export function unlinkEntity(entity3D) {
    entityToMarker2D.delete(entity3D);
}

/**
 * انتقال یک‌به‌یک لایه‌ها و اشکال از ۲D به ۳D (بازگشت آرایه موجودیت‌های ساخته‌شده)
 */
export function syncLayerTo3D(layer, type, viewer3D) {
    if (!viewer3D) return [];
    const created = [];

    if (type === 'circle' || layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        created.push(viewer3D.entities.add({
            position: Cesium.Cartesian3.fromDegrees(center.lng, center.lat),
            ellipse: {
                semiMinorAxis: radius,
                semiMajorAxis: radius,
                material: Cesium.Color.CYAN.withAlpha(0.35),
                outline: true,
                outlineColor: Cesium.Color.CYAN,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
    } else if (type === 'polygon' || layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        const degreesArray = [];
        latlngs.forEach(pt => degreesArray.push(pt.lng, pt.lat));
        created.push(viewer3D.entities.add({
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                material: Cesium.Color.RED.withAlpha(0.4),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        }));
    } else if (type === 'polyline' || layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs();
        const degreesArray = [];
        latlngs.forEach(pt => degreesArray.push(pt.lng, pt.lat));
        created.push(viewer3D.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                width: 4,
                material: Cesium.Color.CYAN,
                clampToGround: true
            }
        }));
    } else if (type === 'marker' || layer instanceof L.Marker) {
        const pt = layer.getLatLng();
        created.push(viewer3D.entities.add({
            position: Cesium.Cartesian3.fromDegrees(pt.lng, pt.lat),
            point: { pixelSize: 10, color: Cesium.Color.YELLOW }
        }));
    }

    return created;
}

/**
 * ثبت هر لایه ترسیمی (چه از طریق ابزار رسم روی نقشه، چه به‌صورت برنامه‌نویسی‌شده
 * مثل ابزار ویوشید) در نگاشت لایه↔موجودیت سه‌بعدی، تا هنگام پاک‌سازی همزمان حذف شوند.
 */
export function registerDrawnLayer(layer, type, viewer3D) {
    const entities = syncLayerTo3D(layer, type, viewer3D);
    if (entities && entities.length) layerTo3DEntities.set(layer, entities);
    return entities;
}

/** افزودن یک موجودیت سه‌بعدی اضافی (مثلاً گنبد میدان دید) به فهرست حذفِ همزمانِ یک لایه دو بعدی موجود */
export function attachExtra3DEntity(layer, entity3D) {
    if (!layer || !entity3D) return;
    const list = layerTo3DEntities.get(layer) || [];
    list.push(entity3D);
    layerTo3DEntities.set(layer, list);
}

/** حذف موجودیت‌های سه‌بعدی متناظر یک لایه ترسیمی (و پاک‌سازی نگاشت‌ها) - قابل استفاده از سایر ماژول‌ها نیز */
export function removeLinked3DEntities(layer, viewer3D) {
    const entities = layerTo3DEntities.get(layer);
    if (entities && viewer3D) {
        entities.forEach(ent => {
            unlinkEntity(ent);
            viewer3D.entities.remove(ent);
        });
    }
    layerTo3DEntities.delete(layer);
}

function updateMeasureOutput(layer, type) {
    const out = document.getElementById('measure-output');
    if (!out) return;
    if (type === 'polygon' && layer.getLatLngs) {
        const latlngs = layer.getLatLngs()[0];
        const area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(latlngs) : computeAreaFallback(latlngs);
        out.innerHTML = `مساحت چندضلعی: <b>${(area / 1e6).toFixed(3)} کیلومتر مربع</b>`;
    } else if (type === 'polyline' && layer.getLatLngs) {
        let dist = 0;
        const pts = layer.getLatLngs();
        for (let i = 1; i < pts.length; i++) dist += pts[i - 1].distanceTo(pts[i]);
        out.innerHTML = `طول خط ترسیم‌شده: <b>${(dist / 1000).toFixed(3)} کیلومتر</b>`;
    } else if (type === 'circle') {
        out.innerHTML = `شعاع دایره: <b>${(layer.getRadius() / 1000).toFixed(3)} کیلومتر</b>`;
    }
}

function computeAreaFallback(latlngs) {
    let area = 0;
    for (let i = 0, len = latlngs.length; i < len; i++) {
        const p1 = latlngs[i], p2 = latlngs[(i + 1) % len];
        area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    return Math.abs(area * 6378137.0 * 6378137.0 / 2.0);
}

/**
 * موتور استعلام آنلاین و ترسیم پروفایل ارتفاعی تعاملی
 */
async function generateAdaptiveElevationProfile(polylineLayer, map2D, viewer3D) {
    const latlngs = polylineLayer.getLatLngs();
    const samplesCount = 60;
    const interpolatedPoints = [];

    for (let i = 0; i < latlngs.length - 1; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[i + 1];
        const steps = Math.ceil(samplesCount / (latlngs.length - 1));
        for (let j = 0; j < steps; j++) {
            const t = j / steps;
            const lat = p1.lat + (p2.lat - p1.lat) * t;
            const lng = p1.lng + (p2.lng - p1.lng) * t;
            interpolatedPoints.push({ lat, lng });
        }
    }
    interpolatedPoints.push({ lat: latlngs[latlngs.length - 1].lat, lng: latlngs[latlngs.length - 1].lng });

    const lats = interpolatedPoints.map(p => p.lat.toFixed(5)).join(',');
    const lngs = interpolatedPoints.map(p => p.lng.toFixed(5)).join(',');

    try {
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
        const data = await res.json();
        const elevations = data.elevation;

        let totalDist = 0;
        const labels = [];
        const elevationData = [];
        let minElev = Infinity, maxElev = -Infinity, totalGain = 0;

        interpolatedPoints.forEach((pt, idx) => {
            if (idx > 0) {
                const prev = interpolatedPoints[idx - 1];
                const d = L.latLng(prev.lat, prev.lng).distanceTo(L.latLng(pt.lat, pt.lng));
                totalDist += d;
                const diff = elevations[idx] - elevations[idx - 1];
                if (diff > 0) totalGain += diff;
            }
            labels.push((totalDist / 1000).toFixed(2));
            elevationData.push(elevations[idx]);
            if (elevations[idx] < minElev) minElev = elevations[idx];
            if (elevations[idx] > maxElev) maxElev = elevations[idx];
        });

        document.getElementById('stat-min').innerText = Math.round(minElev);
        document.getElementById('stat-max').innerText = Math.round(maxElev);
        document.getElementById('stat-gain').innerText = Math.round(totalGain);
        document.getElementById('stat-length').innerText = (totalDist / 1000).toFixed(2);
        document.getElementById('elevation-profile-panel').style.display = 'flex';

        const ctx = document.getElementById('elevationChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ارتفاع (متر)',
                    data: elevationData,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onHover: (event, activeElements) => {
                    if (activeElements && activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const targetPt = interpolatedPoints[index];
                        updateHoverMarkers(targetPt.lat, targetPt.lng, elevations[index], map2D, viewer3D);
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'فاصله (کیلومتر)', color: '#94a3b8' }, ticks: { color: '#64748b' } },
                    y: { title: { display: true, text: 'ارتفاع (متر)', color: '#94a3b8' }, ticks: { color: '#64748b' } }
                },
                plugins: { legend: { display: false } }
            }
        });

    } catch (e) {
        console.error("خطا در استعلام ارتفاع:", e);
        alert("خطا در دریافت داده‌های ارتفاعی.");
    }
}

function updateHoverMarkers(lat, lng, elev, map2D, viewer3D) {
    if (!profileHoverMarker2D) {
        profileHoverMarker2D = L.circleMarker([lat, lng], { radius: 7, color: '#ef4444', fillColor: '#fff', fillOpacity: 1 }).addTo(map2D);
    } else {
        profileHoverMarker2D.setLatLng([lat, lng]);
    }

    if (viewer3D) {
        if (!profileHoverEntity3D) {
            profileHoverEntity3D = viewer3D.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lng, lat, (elev || 0) + 20),
                point: { pixelSize: 12, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }
            });
        } else {
            profileHoverEntity3D.position = Cesium.Cartesian3.fromDegrees(lng, lat, (elev || 0) + 20);
        }
    }
}

/** بستن پنل پروفایل و حذف کامل نشانگرهای هاور از هر دو نقشه (۲بعدی و ۳بعدی) */
function closeElevationProfile(map2D, viewer3D) {
    const panel = document.getElementById('elevation-profile-panel');
    if (panel) panel.style.display = 'none';
    if (profileHoverMarker2D) { map2D.removeLayer(profileHoverMarker2D); profileHoverMarker2D = null; }
    if (profileHoverEntity3D && viewer3D) { viewer3D.entities.remove(profileHoverEntity3D); profileHoverEntity3D = null; }
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
}

/** منوی شناور مستقل انتخاب نقشه پایه برای یک پنل مشخص (۲بعدی یا ۳بعدی) */
function setupBaseMapPicker({ selectId, toggleId, dropdownId, initialKey, applyFn }) {
    const dropdown = document.getElementById(dropdownId);
    const toggleBtn = document.getElementById(toggleId);
    const select = document.getElementById(selectId);

    // پر کردن select و dropdown با فهرست کامل نقشه‌های پایه
    Object.keys(BASE_MAP_SOURCES).forEach((key) => {
        const item = BASE_MAP_SOURCES[key];
        if (select) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = item.name;
            if (key === initialKey) opt.selected = true;
            select.appendChild(opt);
        }
        if (dropdown) {
            const div = document.createElement('div');
            div.className = `base-item ${key === initialKey ? 'active' : ''}`;
            div.dataset.key = key;
            div.innerHTML = `<i class="fa-solid fa-map"></i> <span>${item.name}</span>`;
            div.addEventListener('click', () => choose(key));
            dropdown.appendChild(div);
        }
    });

    function choose(key) {
        applyFn(key);
        if (select) select.value = key;
        if (dropdown) dropdown.querySelectorAll('.base-item').forEach(el => el.classList.toggle('active', el.dataset.key === key));
        if (dropdown) dropdown.classList.remove('show');
    }

    toggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown?.classList.remove('show'));
    select?.addEventListener('change', (e) => choose(e.target.value));
}

/** بارگذاری زمین‌نمای سه‌بعدی با بازگشت امن در نبود توکن Cesium Ion */
async function setupTerrain(viewer3D, ionToken) {
    try {
        if (ionToken && Cesium.createWorldTerrainAsync) {
            viewer3D.terrainProvider = await Cesium.createWorldTerrainAsync();
        } else if (ionToken && Cesium.Terrain && Cesium.Terrain.fromWorldTerrain) {
            viewer3D.terrainProvider = Cesium.Terrain.fromWorldTerrain();
        } else if (ionToken && Cesium.createWorldTerrain) {
            viewer3D.terrainProvider = Cesium.createWorldTerrain();
        } else {
            viewer3D.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
    } catch (e) {
        console.warn("زمین‌نمای جهانی در دسترس نبود؛ بازگشت به بیضی‌وار ساده.", e);
        viewer3D.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
}

/** لایه‌های حمایتی: مرزهای بین‌المللی (GeoJSON سبک) و اسامی مکان‌ها (کاشی‌های برچسب) */
function setupSupportLayers(map2D, viewer3D) {
    let bordersLayer2D = null;
    let bordersEntities3D = [];
    let placesLayer2D = null;
    let placesLayer3D = null;

    document.getElementById('chk-layer-borders')?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            try {
                const res = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json');
                const data = await res.json();
                bordersLayer2D = L.geoJSON(data, {
                    style: { color: '#f97316', weight: 1, fillOpacity: 0 }
                }).addTo(map2D);

                if (viewer3D) {
                    data.features.forEach(f => {
                        const geom = f.geometry;
                        const rings = geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates.flat() : [];
                        rings.forEach(ring => {
                            const degreesArray = [];
                            ring.forEach(c => degreesArray.push(c[0], c[1]));
                            if (degreesArray.length >= 4) {
                                bordersEntities3D.push(viewer3D.entities.add({
                                    polyline: {
                                        positions: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                                        width: 1.5,
                                        material: Cesium.Color.ORANGE,
                                        clampToGround: true
                                    }
                                }));
                            }
                        });
                    });
                }
            } catch (err) {
                console.error("خطا در بارگذاری مرزها:", err);
            }
        } else {
            if (bordersLayer2D) map2D.removeLayer(bordersLayer2D);
            bordersLayer2D = null;
            if (viewer3D) bordersEntities3D.forEach(ent => viewer3D.entities.remove(ent));
            bordersEntities3D = [];
        }
    });

    document.getElementById('chk-layer-places')?.addEventListener('change', (e) => {
        const labelsUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';
        if (e.target.checked) {
            placesLayer2D = L.tileLayer(labelsUrl, { subdomains: 'abcd', maxZoom: 20, opacity: 0.9 }).addTo(map2D);
            if (viewer3D) {
                placesLayer3D = viewer3D.imageryLayers.addImageryProvider(
                    new Cesium.UrlTemplateImageryProvider({ url: labelsUrl.replace('{s}', 'a'), maximumLevel: 20 })
                );
            }
        } else {
            if (placesLayer2D) map2D.removeLayer(placesLayer2D);
            placesLayer2D = null;
            if (viewer3D && placesLayer3D) viewer3D.imageryLayers.remove(placesLayer3D);
            placesLayer3D = null;
        }
    });
}

function toDMS(lat, lng) {
    const conv = (deg, isLat) => {
        const abs = Math.abs(deg);
        const d = Math.floor(abs);
        const m = Math.floor((abs - d) * 60);
        const s = ((abs - d - m / 60) * 3600).toFixed(1);
        const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
        return `${d}°${m}'${s}"${dir}`;
    };
    return `${conv(lat, true)}, ${conv(lng, false)}`;
}

function convertLatLngToUTM(lat, lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';
    const easting = 500000 + (lng - (zone * 6 - 183)) * 111320 * Math.cos(lat * Math.PI / 180);
    const northing = (lat >= 0 ? lat : lat + 90) * 110574;
    return { zone, hemisphere, easting, northing };
}
