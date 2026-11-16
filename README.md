# Rehber Demo

Telefonun Kişiler uygulamasından dışa aktarılan `.vcf` dosyasını aç. Uygulama adları ve telefon numaralarını UTF-8 düz metne dönüştürüp sunucu arşivine kaydeder. **Kayıtlı dosyalar** üzerinden önceki aktarımlar açılabilir. Arşiv tek yöneticilidir ve yetkili Vercel hesabıyla farklı cihazlardan kullanılabilir.

## Vercel kurulum

1. Bu depoyu **Other** uygulama şablonuyla Vercel'e aktar. `vercel.json` statik çıktı dizinini tanımlar. `api/rehber.js` ayrı bir Node.js Function olarak çalışır.
2. Projenin **Storage** ekranında bir **Private Vercel Blob** deposu oluştur ve projeye bağla. OIDC bağlantısında uygulama `REHBER2026QZAWXSECDRVF99_STORE_ID` veya `BLOB_STORE_ID` değişkenini ve Vercel'in otomatik sağladığı OIDC kimliğini kullanır. Eski token bağlantıları için `BLOB_READ_WRITE_TOKEN` da desteklenir.
3. **Settings → Deployment Protection → Vercel Authentication** altında **Require Log In → All Deployments** seçeneğini etkinleştir. Uygulama ve API erişimi bu korumaya dayanır. Arşiv için kullanacağın adreslere koruma istisnası ekleme.
4. Bir gizli pencereyle HTTPS adresinin ve `/api/rehber` yolunun Vercel girişine yönlendirdiğini doğrula. Yetkili Vercel hesabıyla giriş yaptıktan sonra uygulamayı aç.

Her dosya açılışı arşivde ayrı bir kayıt oluşturur. Ekrandaki **Tümünü temizle** düğmesi yalnızca geçerli önizlemeyi temizler. VCF dosyasının kendisi, e-posta adresleri ve fotoğraflar gönderilmez. Gönderilen metin sınırı 4 MB.

## Google Kişiler ile aktarım

1. Google Cloud projesinde **People API**'yi etkinleştir. Google Auth Platform'da uygulama ve izin ekranını yapılandır. **Data Access** bölümünde `https://www.googleapis.com/auth/contacts.readonly` kapsamını ekle. Uygulama test modundaysa aktarım yapacak Google hesabını test kullanıcısı olarak ekle.
2. **Clients → Create client → Web application** üzerinden istemci oluştur. Yetkili yönlendirme adresine `https://rehber-pwa-demo.vercel.app/api/google-contacts` ekle. Farklı bir alan adı kullanıyorsan tam callback adresini ayrıca Vercel'de `GOOGLE_CONTACTS_REDIRECT_URI` olarak tanımla ve uygulamayı o adresten aç.
3. Vercel'in Production ortamına `GOOGLE_CONTACTS_CLIENT_ID` ve `GOOGLE_CONTACTS_CLIENT_SECRET` ekle. Secret değerini yalnızca Vercel'de sakla. Yeniden deploy et.
4. Kullanıcı **Google Kişiler’den aktar** düğmesine dokunur ve Google'da izin verir. Hesapta kayıtlı kişiler topluca özel arşive yazılır. Geçici Google erişim belirteci kalıcı olarak saklanmaz.
