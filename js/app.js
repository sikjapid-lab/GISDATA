import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی اولیه نقشه
    const { map } = initMap();

    // ۲. بارگذاری ماژول‌ها
    initRoutingModule(map);
    initTrafficModule(map);
    initWeatherModule(map);

    // ۳. مدیریت بستن سایدبار و Resize شدن کامل نقشه
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        
        // به‌روزرسانی ابعاد Leaflet پس از انیمیشن جهت تمام صفحه شدن
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    });

    // ۴. منطق باز و بستن آکاردئون‌ها
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });

    // ۵. مدیریت ذخیره‌سازی کلیدهای API در localStorage
    const owmInput = document.getElementById('api-owm');
    const tomInput = document.getElementById('api-tomtom');
    const orsInput = document.getElementById('api-ors');

    // بارگذاری مقادیر قبلی
    if (owmInput) owmInput.value = localStorage.getItem('API_OWM') || '';
    if (tomInput) tomInput.value = localStorage.getItem('API_TOMTOM') || '';
    if (orsInput) orsInput.value = localStorage.getItem('API_ORS') || '';

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
        localStorage.setItem('API_OWM', owmInput.value.trim());
        localStorage.setItem('API_TOMTOM', tomInput.value.trim());
        localStorage.setItem('API_ORS', orsInput.value.trim());
        alert('تنظیمات و کلیدهای API با موفقیت ذخیره شدند.');
    });
});
