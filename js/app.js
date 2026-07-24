/* js/app.js */
import { initMap, registerDrawnLayer } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';
import { initDisastersModule } from './modules/disasters.js';
import { initAnalysisModule } from './modules/analysis.js';
import { initFeatureSearchModule } from './modules/featureSearch.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی هسته نقشه (دو بعدی + سه بعدی)
    const { map2D, viewer3D, drawnItems, setSyncMode, forceResync } = initMap();

    // ۲. مقداردهی ماژول‌ها
    initRoutingModule(map2D, viewer3D);
    initTrafficModule(map2D, viewer3D);
    initWeatherModule(map2D, viewer3D);
    initDisastersModule(map2D, viewer3D);
    initAnalysisModule(map2D, viewer3D, drawnItems);
    initFeatureSearchModule(map2D, viewer3D, drawnItems);

    // ۳. مدیریت تغییر حالت نمایش (۲D / همزمان / ۳D)
    const appLayout = document.getElementById('app-layout');
    const btn2D = document.getElementById('btn-mode-2d');
    const btnSplit = document.getElementById('btn-mode-split');
    const btn3D = document.getElementById('btn-mode-3d');

    const updateViewMode = (mode) => {
        appLayout.classList.remove('mode-2d', 'mode-split', 'mode-3d');
        appLayout.classList.add(`mode-${mode}`);

        [btn2D, btnSplit, btn3D].forEach(b => b?.classList.remove('active'));
        if (mode === '2d') btn2D?.classList.add('active');
        if (mode === 'split') btnSplit?.classList.add('active');
        if (mode === '3d') btn3D?.classList.add('active');

        setSyncMode(mode);

        setTimeout(() => {
            map2D.invalidateSize();
            if (viewer3D && viewer3D.resize) viewer3D.resize();
        }, 220);
    };

    btn2D?.addEventListener('click', () => updateViewMode('2d'));
    btnSplit?.addEventListener('click', () => updateViewMode('split'));
    btn3D?.addEventListener('click', () => updateViewMode('3d'));

    // اطمینان از هم‌خوانی کامل حالت اولیه (HTML با کلاس پیش‌فرض mode-split بارگذاری می‌شود)
    setSyncMode('split');
    setTimeout(() => {
        map2D.invalidateSize();
        if (viewer3D && viewer3D.resize) viewer3D.resize();
    }, 150);

    document.getElementById('btn-force-resync')?.addEventListener('click', () => {
        map2D.invalidateSize();
        if (viewer3D && viewer3D.resize) viewer3D.resize();
        forceResync();
    });

    // ۴. مدیریت آکاردئون‌های پنل جانبی
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });

    // ۵. دکمه باز و بستن سایدبار
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
            map2D.invalidateSize();
            if (viewer3D && viewer3D.resize) viewer3D.resize();
        }, 320);
    });

    // ۶. تنظیمات و کلیدهای API (ذخیره محلی امن در مرورگر)
    initSettingsPanel();

    // ۷. ورود / خروج GeoJSON
    initGeoJsonIO(map2D, viewer3D, drawnItems);

    // ۸. چاپ / خروجی تصویری نقشه
    document.getElementById('btn-print-map')?.addEventListener('click', () => window.print());
});

function initSettingsPanel() {
    const inputOwm = document.getElementById('api-owm');
    const inputTomtom = document.getElementById('api-tomtom');
    const inputCesiumIon = document.getElementById('api-cesium-ion');
    const status = document.getElementById('settings-status');

    // بارگذاری کلیدهای ذخیره‌شده هنگام شروع برنامه
    if (inputOwm) inputOwm.value = localStorage.getItem('apiOwm') || '';
    if (inputTomtom) inputTomtom.value = localStorage.getItem('apiTomTom') || '';
    if (inputCesiumIon) inputCesiumIon.value = localStorage.getItem('apiCesiumIon') || '';

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
        localStorage.setItem('apiOwm', inputOwm?.value?.trim() || '');
        localStorage.setItem('apiTomTom', inputTomtom?.value?.trim() || '');
        localStorage.setItem('apiCesiumIon', inputCesiumIon?.value?.trim() || '');
        if (status) {
            status.innerHTML = '✅ تنظیمات با موفقیت در مرورگر شما ذخیره شد.';
            status.style.borderRightColor = '#16a34a';
        }
    });

    document.getElementById('btn-clear-settings')?.addEventListener('click', () => {
        localStorage.removeItem('apiOwm');
        localStorage.removeItem('apiTomTom');
        localStorage.removeItem('apiCesiumIon');
        if (inputOwm) inputOwm.value = '';
        if (inputTomtom) inputTomtom.value = '';
        if (inputCesiumIon) inputCesiumIon.value = '';
        if (status) {
            status.innerHTML = '🗑️ کلیدهای ذخیره‌شده پاک شدند.';
            status.style.borderRightColor = '#ef4444';
        }
    });
}

function initGeoJsonIO(map2D, viewer3D, drawnItems) {
    const fileInput = document.getElementById('file-input-geojson');
    const btnExport = document.getElementById('btn-export-geojson');

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isKml = file.name.toLowerCase().endsWith('.kml');
        if (isKml) {
            alert('فرمت KML در این نسخه پشتیبانی نمی‌شود؛ لطفاً فایل را به GeoJSON تبدیل کرده و مجدداً بارگذاری کنید.');
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const geojson = JSON.parse(evt.target.result);
                const imported = L.geoJSON(geojson, {
                    pointToLayer: (feature, latlng) => L.marker(latlng),
                    style: { color: '#0284c7', weight: 3 }
                });

                imported.eachLayer(layer => {
                    drawnItems.addLayer(layer);
                    const layerType = layer instanceof L.Marker ? 'marker'
                        : layer instanceof L.Polygon ? 'polygon'
                        : layer instanceof L.Polyline ? 'polyline' : null;
                    if (layerType) registerDrawnLayer(layer, layerType, viewer3D);
                });

                if (imported.getBounds().isValid()) {
                    map2D.fitBounds(imported.getBounds());
                }
            } catch (err) {
                console.error("خطا در پردازش فایل GeoJSON:", err);
                alert('فایل انتخاب‌شده یک GeoJSON معتبر نیست.');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    btnExport?.addEventListener('click', () => {
        const featureCollection = drawnItems.toGeoJSON();
        if (!featureCollection.features.length) {
            alert('هیچ ترسیمی برای خروجی گرفتن وجود ندارد.');
            return;
        }
        const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gis-export-${Date.now()}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}
