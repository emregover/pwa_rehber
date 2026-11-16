# Rehber Demo

Telefonun Kişiler uygulamasından dışa aktarılan `.vcf` dosyasını aç. Uygulama adları ve telefon numaralarını UTF-8 düz metne dönüştürüp sunucu arşivine kaydeder. **Kayıtlı dosyalar** üzerinden önceki aktarımlar açılabilir. Arşiv tek yöneticilidir ve aynı erişim anahtarıyla farklı cihazlardan kullanılabilir.

## Vercel kurulum

1. Bu depoyu **Other** uygulama şablonuyla Vercel'e aktar. `vercel.json` statik çıktı dizinini tanımlar. `api/rehber.js` ayrı bir Node.js Function olarak çalışır.
2. Projenin **Storage** ekranında bir **Private Vercel Blob** deposu oluştur ve projeye bağla. Vercel `BLOB_READ_WRITE_TOKEN` değişkenini sağlar.
3. **Settings → Environment Variables** altında `REHBER_ERISIM_ANAHTARI` için en az 24 karakterlik rastgele bir anahtar ayarla. Örneğin `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` ile üretebilirsin. Anahtar GitHub'a eklenmez. Gerekirse yeni bir deployment başlat.
4. Uygulamayı HTTPS adresinde açıp anahtarı gir. Dosya aktarımları ve arşiv erişimi için anahtar gerekir. Önizleme ve üretim için aynı özel arşivi bağlarsan iki ortam aynı kayıtlara erişir.

Her dosya açılışı arşivde ayrı bir kayıt oluşturur. Ekrandaki **Tümünü temizle** düğmesi yalnızca geçerli önizlemeyi temizler. VCF dosyasının kendisi, e-posta adresleri ve fotoğraflar gönderilmez. Gönderilen metin sınırı 4 MB.
