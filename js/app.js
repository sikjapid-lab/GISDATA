import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی اولیه نقشه پایه
    const { map } = initMap();

    // ۲. بارگذاری ماژول‌ها (به صورت ایمن)
    try { initRoutingModule(map); } catch (e) { console.error('خطا در ماژول مسیریابی:', e); }
    try { initTrafficModule(map); } catch (e) { console.error('خطا در ماژول ترافیک:', e); }
    try { initWeatherModule(map); } catch (e) { console.error('خطا در ماژول هواشناسی:', e); }

    // ۳. راه اندازی منوی آکاردئونی سایدبار
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            
            // بستن سایر بخش‌ها برای تمیز ماندن منو (اختیاری)
            document.querySelectorAll('.accordion-item').forEach(i => {
                if (i !== item) i.classList.remove('active');
            });

            item.classList.toggle('active');
        });
    });

    // ۴. منطق باز و بستن Sidebar
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
});
