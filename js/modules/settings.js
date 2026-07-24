/* js/modules/settings.js
 * کمک‌تابع مشترک برای واکشی کلیدهای API: ابتدا از localStorage خوانده می‌شود؛
 * اگر خالی بود، مقدار زنده‌ی فیلد ورودی مربوطه در بخش «تنظیمات» نیز بررسی و
 * در صورت وجود، به‌طور خودکار ذخیره می‌شود. این کار مشکل «کلید وارد شد ولی هیچ
 * اکشنی رخ نداد» را برطرف می‌کند؛ چون کاربر مجبور نیست حتماً دکمه ذخیره را بزند.
 */
const KEY_TO_INPUT_ID = {
    apiOwm: 'api-owm',
    apiTomTom: 'api-tomtom',
    apiCesiumIon: 'api-cesium-ion'
};

export function getApiKey(storageKey) {
    let value = (localStorage.getItem(storageKey) || '').trim();
    if (value) return value;

    const inputId = KEY_TO_INPUT_ID[storageKey];
    const input = inputId ? document.getElementById(inputId) : null;
    const liveValue = (input?.value || '').trim();
    if (liveValue) {
        localStorage.setItem(storageKey, liveValue);
        return liveValue;
    }
    return '';
}
