/* js/app.js */
import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';
import { initDisastersModule } from './modules/disasters.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی هسته نقشه
    const { map2D, viewer3D, drawnItems } = initMap();

    // ۲. مقداردهی ماژول‌ها
    initRoutingModule(map2D, viewer3D);
    initTrafficModule(map2D, viewer3D);
    initWeatherModule(map2D, viewer3D);
    initDisastersModule(map2D, viewer3D);

    // ۳. مدیریت تغییر حالت نمایش (۲D / Split / 3D)
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

        setTimeout(() => {
            map2D.invalidateSize();
            if (viewer3D && viewer3D.resize) viewer3D.resize();
        }, 200);
    };

    btn2D?.addEventListener('click', () => updateViewMode('2d'));
    btnSplit?.addEventListener('click', () => updateViewMode('split'));
    btn3D?.addEventListener('click', () => updateViewMode('3d'));

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
        }, 300);
    });
});
