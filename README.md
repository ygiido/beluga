# 🐋 Beluga Ultra Logger & Stream Alerts (v0.0.1)

Beluga, Discord sunucunuzdaki her türlü hareketi (ses, mikrofon, kamera, yayın, silinen görseller, ghost pingler, roller, kanallar vb.) kaydeden ve **YouTube / Kick** yayıncıları canlı yayına geçtiğinde sunucunuza anında butonlu duyuru gönderen hepsi bir arada denetim botudur.

## 🎯 Özellikler

### 1. 🔴 Canlı Yayın Duyuru Motoru (YouTube & Kick)
* **Otomatik Kontrol:** Eklenen YouTube ve Kick kanallarını her 60 saniyede bir tarar.
* **Zengin Embed Duyurusu:** Yayın başlığı, oyun/kategori, canlı izleyici sayısı, yayın kapak görseli ve yayıncının avatarı ile estetik duyuru.
* **Butonlu Arayüz:** Mesajın altındaki **"🔴 Yayına Katıl ve İzle"** butonuna basarak doğrudan yayına geçme imkanı.
* **Rol Etiketleme (Ping):** İsteğe bağlı `@everyone`, `@here` veya özel bir rolü etiketleme seçeneği.
* **Yinelenme Koruması:** Yayın devam ettiği sürece tekrar tekrar duyuru atmaz.

### 2. 🎙️ Ses, Mikrofon & Kamera Logları
* Odaya katıldı / ayrıldı / kanal değiştirdi.
* **Net Mesai Süresi:** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
* Kendi mikrofonunu kapattı (Mute) 🔇 / açtı 🎙️.
* Kendi kulaklığını kapattı (Deafen) 🎧 / açtı 🔊.
* Sunucu müdahalesi (Yetkili susturdu / sağırlaştırdı).
* Kamera açtı 📹 / kapattı 📷.
* Ekran / oyun yayını başlattı 🖥️ / durdurdu.

### 3. 💬 Mesaj Logları & Medya Kurtarma
* **Silinen Medyaları Kurtarma:** Silinen fotoğraf, video veya dosyaları Discord CDN'den kaybolmadan hemen önce çekip log kanalına kanıt dosyası olarak yükler.
* **Ghost Ping Avcısı:** Birini etiketleyip ilk 60 saniye içinde mesajını silenleri ifşa eder.
* **Mesaj Düzenleme:** Eski ve yeni halini gösterir, mesaja gitme linki verir.
* **Toplu Silme (Purge):** Silinen mesaj adedini ve yetkiliyi gösterir.

### 4. 👤 Üye Hareketleri Logu
* Giriş yapanın hesap yaşı (günlük) ve davet eden kişi / davet kodu.
* Sunucudan ayrılan üyenin kaldığı süre ve ayrılırkenki rolleri.
* **Sahte Davet:** 24 saat dolmadan çıkan hesapları işaretler.
* İsim/nickname değişiklikleri, rol alıp verme (Audit Log ile yapan yetkili), Timeout ve Ban/Unban.

### 5. 🏛️ Sunucu, Kanal & Rol Logları
* Kanal ve rol oluşturma, silme veya isim/renk değişiklikleri (Audit Log yetkilisiyle birlikte).

### 6. 🚨 Güvenlik Alarmları
* **Kritik Rol İzni Kırmızı Alarmı:** Bir role Yönetici, Ban, Kick yetkisi verildiğinde `@everyone` etiketli acil durum bildirimi.
* **Anti-Nuke:** 10 saniyede birden fazla kanal/rol silmeye kalkan yetkilinin yetkilerini sıfırlar.
* **Şüpheli Hesap:** 15 günden yeni hesaplara sarı risk uyarısı verir.

---

## ⚙️ Kurulum & Kullanım

Sunucunuzda herhangi bir yetkili kanalında:
```
/ayarlar
```
Açılan kontrol panelinden:
* **`📜 Log & Denetim Kanalları Ayarları`** seçeneğinden mesaj, ses, medya vb. kanallarını bağlayabilirsiniz.
* **`🔴 YouTube & Kick Canlı Yayın Duyuruları`** seçeneğinden duyuru kanalını seçebilir, bildirim rolünü ayarlayabilir ve Modal form ile dilediğiniz kadar Kick veya YouTube yayıncısı ekleyip/silebilirsiniz!
