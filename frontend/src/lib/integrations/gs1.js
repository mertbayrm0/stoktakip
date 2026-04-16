// Depozio — Integration placeholders
// -----------------------------------------------------------------
// Bu dosyalar gelecekteki entegrasyonlar için yer tutucudur.
// Şu an hiçbiri implemente edilmedi. İlgili servisten API anahtarı
// alındığında ilgili fonksiyonlar bu dosyalarda gerçekleştirilecek.

// GS1 Türkiye Verified API
// TODO: Implementation — https://verified.gs1tr.org/
// - lookupByGtin(gtin) → { name, brand, category, content_ml_g, image_url }
export async function lookupByGtin(_gtin) {
    throw new Error("GS1 integration not yet configured");
}
