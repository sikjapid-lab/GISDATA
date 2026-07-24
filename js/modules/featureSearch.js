/**
 * ماژول جستجوی عوارض طبیعی و مصنوعی — بر اساس الگوی موفق ارائه‌شده توسط کاربر
 * (Overpass API، رایگان و بدون کلید، با چند سرور fail-over).
 * محدوده جستجو از روی آخرین شکل رسم‌شده با ابزار رسم موجود (بخش «۶. اندازه‌گیری») خوانده
 * می‌شود؛ نتایج به‌طور هم‌زمان روی هر دو نقشه (۲بعدی/۳بعدی) رسم و به هم متصل می‌شوند و
 * خروجی اکسل نیز پشتیبانی می‌شود.
 */
import { linkMarkerAndEntity, unlinkEntity } from '../map.js';

const OSM_DICTIONARY = {
    "خطوط برق": "power=line", "دکل مخابراتی": "man_made=tower", "تاسیسات مخابراتی": "telecom=exchange",
    "خطوط آب": "man_made=pipeline", "خطوط نفت": "man_made=pipeline", "خطوط گاز": "man_made=pipeline",
    "پالایشگاه": "industrial=refinery", "نیروگاه برق": "power=plant", "پست برق": "power=substation",
    "مخزن سوخت": "man_made=storage_tank", "دکل حفاری": "man_made=drilling_rig", "سد": "waterway=dam",
    "پادگان": "landuse=military", "پایگاه هوایی نظامی": "aeroway=aerodrome", "منطقه ممنوعه نظامی": "military=danger_zone",
    "پناهگاه": "military=bunker", "تاسیسات دریایی نظامی": "military=naval_base", "ایستگاه رادار": "military=radar",
    "جاده": "highway", "بندر و اسکله": "harbour=yes", "اسکله": "man_made=pier", "لنگرگاه": "mooring=yes",
    "فرودگاه": "aeroway=aerodrome", "باند پرواز": "aeroway=runway", "تونل": "tunnel=yes", "پل": "bridge=yes",
    "ایستگاه راه‌آهن": "railway=station", "خطوط راه‌آهن": "railway=rail", "انبار لجستیک": "building=warehouse",
    "پمپ بنزین": "amenity=fuel", "ترمینال مسافربری": "amenity=bus_station",
    "بیمارستان": "amenity=hospital", "درمانگاه": "amenity=clinic", "مدرسه": "amenity=school",
    "دانشگاه": "amenity=university", "مسجد": "amenity=place_of_worship", "پارک": "leisure=park",
    "هتل": "tourism=hotel", "رستوران": "amenity=restaurant", "بانک": "amenity=bank", "کارخانه": "landuse=industrial",
    "رودخانه": "waterway=river", "دریاچه": "natural=water", "جنگل": "natural=wood", "کوه / قله": "natural=peak",
    "غار": "natural=cave_entrance", "ساحل": "natural=beach", "بیابان": "natural=desert", "آبشار": "waterway=waterfall"
};

const FEATURE_GROUPS = {
    "🚚 ترابری، تقاطع‌ها و بنادر": ["پل", "تونل", "جاده", "فرودگاه", "باند پرواز", "خطوط راه‌آهن", "ایستگاه راه‌آهن", "بندر و اسکله", "اسکله", "لنگرگاه", "ترمینال مسافربری"],
    "⚡ انرژی و تاسیسات حیاتی": ["خطوط برق", "نیروگاه برق", "پست برق", "پالایشگاه", "مخزن سوخت", "دکل حفاری", "دکل مخابراتی", "تاسیسات مخابراتی", "خطوط آب", "خطوط نفت", "خطوط گاز", "سد", "پمپ بنزین"],
    "🪖 نظامی و امنیتی": ["پادگان", "پایگاه هوایی نظامی", "منطقه ممنوعه نظامی", "پناهگاه", "تاسیسات دریایی نظامی", "ایستگاه رادار"],
    "🌍 عوارض طبیعی": ["رودخانه", "دریاچه", "جنگل", "کوه / قله", "غار", "ساحل", "بیابان", "آبشار"],
    "🏙 خدمات شهری": ["بیمارستان", "درمانگاه", "مدرسه", "دانشگاه", "مسجد", "پارک", "هتل", "رستوران", "بانک", "کارخانه", "انبار لجستیک"]
};

const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.osm.ch/api/interpreter"
];

let searchBBox = null;
let featureLeafletGroup = null;
let featurePairs = []; // { marker2D, entity3D }
let featureResultsData = [];

export function initFeatureSearchModule(map2D, viewer3D, drawnItems) {
    featureLeafletGroup = L.layerGroup().addTo(map2D);

    fillTreeMenu();
    document.getElementById('feature-tree-menu')?.addEventListener('change', function () {
        if (this.value) document.getElementById('feature-keyword-input').value = this.value;
    });

    // محدوده جستجو از روی آخرین شکل رسم‌شده با ابزار رسم موجود (topleft، بخش «۶. اندازه‌گیری») خوانده می‌شود
    map2D.on(L.Draw.Event.CREATED, (e) => {
        const b = e.layer.getBounds();
        if (b && b.isValid()) {
            searchBBox = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
            setInfo('محدوده جستجو ثبت شد. اکنون دسته‌بندی/کلمه کلیدی را انتخاب و دکمه جستجو را بزنید.');
        }
    });

    document.getElementById('btn-run-feature-search')?.addEventListener('click', () => runFeatureSearch(map2D, viewer3D));
    document.getElementById('btn-clear-feature-search')?.addEventListener('click', () => clearFeatureSearch(map2D, viewer3D));
    document.getElementById('btn-export-feature-excel')?.addEventListener('click', exportFeatureExcel);
}

function fillTreeMenu() {
    const sel = document.getElementById('feature-tree-menu');
    if (!sel) return;
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = '-- انتخاب دسته‌بندی تخصصی عوارض --';
    sel.appendChild(blank);
    Object.keys(FEATURE_GROUPS).forEach(groupName => {
        const og = document.createElement('optgroup');
        og.label = groupName;
        FEATURE_GROUPS[groupName].forEach(item => {
            const opt = document.createElement('option');
            opt.value = item; opt.textContent = item;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });
}

async function runFeatureSearch(map2D, viewer3D) {
    if (!searchBBox) {
        setInfo('⚠️ ابتدا با ابزار رسم (گوشه بالا-چپ نقشه دو بعدی)، یک محدوده مستطیلی یا چندضلعی رسم کنید.');
        return;
    }
    const keyword = document.getElementById('feature-keyword-input').value.trim();
    if (!keyword) {
        setInfo('⚠️ لطفاً یک دسته‌بندی انتخاب کنید یا کلمه کلیدی وارد نمایید.');
        return;
    }

    const lengthFilter = parseFloat(document.getElementById('feature-length-filter').value) || 0;
    const widthFilter = parseFloat(document.getElementById('feature-width-filter').value) || 0;
    const heightFilter = parseFloat(document.getElementById('feature-height-filter').value) || 0;
    const filterMode = document.getElementById('feature-filter-mode').value;

    const osmTag = OSM_DICTIONARY[keyword] || ('name~"' + keyword.replace(/"/g, '') + '",i');
    const b = searchBBox;
    const query = '[out:json][timeout:25];(nwr[' + osmTag + '](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + '););out center;';

    const runBtn = document.getElementById('btn-run-feature-search');
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال اتصال به سرورهای Overpass...';
    runBtn.disabled = true;
    setInfo('<i class="fa-solid fa-spinner fa-spin"></i> در حال جستجو در محدوده رسم‌شده...');

    let data = null;
    let lastError = '';
    for (const server of OVERPASS_SERVERS) {
        try {
            const res = await fetch(server, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query)
            });
            if (res.ok) { data = await res.json(); break; }
            lastError = server + ' -> HTTP ' + res.status;
        } catch (err) {
            lastError = server + ' -> ' + err.message;
            console.warn(lastError);
        }
    }

    runBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> اجرای جستجو در محدوده رسم‌شده';
    runBtn.disabled = false;

    if (!data) {
        setInfo('🛑 اتصال به هیچ‌یک از سرورهای Overpass برقرار نشد. جزئیات: ' + lastError);
        return;
    }

    processFeatureResults(data.elements || [], b, lengthFilter, widthFilter, heightFilter, filterMode, map2D, viewer3D);
}

function processFeatureResults(elements, bbox, lengthFilter, widthFilter, heightFilter, filterMode, map2D, viewer3D) {
    clearFeatureSearch(map2D, viewer3D, true);

    let counter = 0;
    elements.forEach(el => {
        const tags = el.tags || {};
        let lat, lon;
        if (el.center) { lat = el.center.lat; lon = el.center.lon; }
        else if (el.lat !== undefined && el.lon !== undefined) { lat = el.lat; lon = el.lon; }
        else return;

        if (!(bbox.south <= lat && lat <= bbox.north && bbox.west <= lon && lon <= bbox.east)) return;

        const lengthVal = extractNumber(tags.length);
        const widthVal = extractNumber(tags.width);
        const heightVal = extractNumber(tags.height || tags['building:levels']);

        const checks = [];
        if (lengthFilter > 0) checks.push(lengthVal !== null && lengthVal <= lengthFilter);
        if (widthFilter > 0) checks.push(widthVal !== null && widthVal <= widthFilter);
        if (heightFilter > 0) checks.push(heightVal !== null && heightVal <= heightFilter);
        if (checks.length) {
            const passed = filterMode === 'and' ? checks.every(Boolean) : checks.some(Boolean);
            if (!passed) return;
        }

        counter++;
        const nameFa = tags['name:fa'] || tags.name || tags.bridge || tags.highway || ('عارضه ' + counter);
        const lengthDisp = tags.length || 'نامشخص';
        const widthDisp = tags.width || 'نامشخص';
        const heightDisp = tags.height || tags['building:levels'] || 'نامشخص';
        const dimStr = 'طول (' + lengthDisp + ') | عرض (' + widthDisp + ') | ارتفاع (' + heightDisp + ')';
        const ddStr = lat.toFixed(6) + ', ' + lon.toFixed(6);
        const dmsStr = ddToDms(lat, true) + ', ' + ddToDms(lon, false);

        featureResultsData.push({ 'ردیف': counter, 'نام یا طبقه عارضه': nameFa, 'پارامترهای سازه': dimStr, 'مختصات اعشاری DD': ddStr, 'مختصات درجه دقیقه ثانیه DMS': dmsStr });

        const marker2D = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 0.9 })
            .bindPopup('<div style="direction:rtl;text-align:right;font-family:Vazirmatn,sans-serif;"><b>' + nameFa + '</b><br>' + dimStr + '<br><span style="font-family:monospace;">' + ddStr + '</span></div>');
        featureLeafletGroup.addLayer(marker2D);

        let entity3D = null;
        if (viewer3D) {
            entity3D = viewer3D.entities.add({
                name: nameFa,
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                point: { pixelSize: 9, color: Cesium.Color.fromCssColorString('#2563eb'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
                description: `<div style="direction:rtl;">${nameFa} — ${dimStr}</div>`
            });
            linkMarkerAndEntity(marker2D, entity3D, viewer3D);
        }

        featurePairs.push({ marker2D, entity3D });
    });

    if (counter === 0) {
        setInfo('هیچ عارضه‌ای در این محدوده با فیلترهای انتخابی یافت نشد. کلمه کلیدی، محدوده یا فیلتر ابعاد را تغییر دهید.');
        document.getElementById('btn-export-feature-excel').style.display = 'none';
    } else {
        setInfo(`✅ تعداد <b>${toFa(counter)}</b> عارضه در محدوده رسم‌شده یافت شد.`);
        document.getElementById('btn-export-feature-excel').style.display = 'block';
    }
}

function clearFeatureSearch(map2D, viewer3D, keepBBox) {
    featureLeafletGroup?.clearLayers();
    featurePairs.forEach(({ entity3D }) => {
        if (entity3D) {
            unlinkEntity(entity3D);
            if (viewer3D) viewer3D.entities.remove(entity3D);
        }
    });
    featurePairs = [];
    featureResultsData = [];
    document.getElementById('btn-export-feature-excel').style.display = 'none';
    if (!keepBBox) {
        setInfo('نتایج جستجو پاک‌سازی شد. برای جستجوی جدید، یک محدوده رسم کنید.');
    }
}

function exportFeatureExcel() {
    if (!featureResultsData.length || typeof XLSX === 'undefined') return;
    const ws = XLSX.utils.json_to_sheet(featureResultsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش عوارض');
    XLSX.writeFile(wb, 'GIS_Feature_Report.xlsx');
}

function extractNumber(value) {
    if (value === null || value === undefined) return null;
    const m = String(value).match(/[-+]?\d*\.?\d+/);
    return m ? parseFloat(m[0]) : null;
}

function ddToDms(dd, isLat) {
    let direction = isLat ? 'N' : 'E';
    if (dd < 0) direction = isLat ? 'S' : 'W';
    dd = Math.abs(dd);
    const degrees = Math.floor(dd);
    const minutesFloat = (dd - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = Math.round((minutesFloat - minutes) * 60 * 100) / 100;
    return degrees + "°" + minutes + "'" + seconds + '"' + direction;
}

function toFa(n) {
    return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function setInfo(html) {
    const box = document.getElementById('feature-search-info');
    if (box) box.innerHTML = html;
}
