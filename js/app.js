import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. راه اندازی نقشه اصلی و UI
    const { map } = initMap();

    // ۲. بارگذاری گام اول: ماژول ناوبری و مسیریابی
    initRoutingModule(map);

    console.log("گام اول (ناوبری و UI پیشرفته) با موفقیت فعال شد.");
});
