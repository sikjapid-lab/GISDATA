import { initMap } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
    // راه اندازی هسته نقشه
    const { map, layerControl, overlayMaps } = initMap();

    console.log("گام اول: نقشه پایه با موفقیت بارگذاری شد.");
    
    // شیء سراسری جهت دسترسی ماژول‌های بعدی در مراحل آینده
    window.AppMap = { map, layerControl, overlayMaps };
});
