# 🐋 Beluga Ultra Logger, Stream Alerts & Auto-Moderation (v0.0.1)

Beluga, Discord sunucunuzdaki her türlü hareketi kaydeden, **YouTube & Kick** canlı yayınlarını duyuran ve **küfür/spam/flood** durumunda Discord'un kendi **zaman aşımı (timeout)** sistemini katlanarak artıran gelişmiş bir Discord botudur.

## 🎯 Özellikler

### 1. 🛡️ Akıllı Auto-Moderation & Katlanan Timeout Sistemi
* **Tetikleyiciler:**
  * **Küfür & Hakaret:** Leetspeak (`0->o`, `1->i`, `@->a`), harf uzatmaları (`siiikkk`) ve araya nokta/boşluk koyma taktiklerini normalize ederek yakalar.
  * **Spam:** 3 saniyede 4+ mesaj gönderenleri tespit eder.
  * **Flood:** Aynı mesajı art arda kopyalayıp atanları veya devasa karakter/satır flood'larını yakalar.
* **Katlanan Süre Mantığı (20 Dakikadan Başlayarak):**
  * **1. İhlal:** 20 Dakika Timeout
  * **2. İhlal:** 40 Dakika Timeout (2 katı)
  * **3. İhlal:** 80 Dakika (1 Saat 20 Dk) Timeout
  * **4. İhlal:** 160 Dakika (2 Saat 40 Dk) Timeout
  * Her ihlalde ceza katlanarak devam eder (Discord'un 28 günlük üst sınırına kadar).
* **Temizlik & Bildirim:**
  * İhlal mesajı anında silinir.
  * Kanala 8 saniyede kendini imha eden ceza uyarısı düşer.
  * Log kanalına detaylı ihlal raporu gönderilir.
  * Yetkililer (`ManageMessages` veya `Administrator`) cezadan muaftır.

### 2. 🔴 Canlı Yayın Duyuru Motoru (YouTube & Kick)
* Eklenen kanalları periyodik tarar, yayın başladığı an butonlu estetik embed atar.
* Yayıncı kapak görseli, canlı izleyici, kategori ve **"🔴 Yayına Katıl ve İzle"** link butonu.
* Opsiyonel `@everyone`, `@here` veya özel rol etiketleme.

### 3. 🎙️ Ses, Mikrofon & Kamera Logları
* Odaya katıldı / ayrıldı / kanal değiştirdi.
* **Net Mesai Süresi:** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
* Mikrofon kapatma/açma 🔇🎙️, kulaklık kapatma/açma 🎧🔊, kamera 📹📷, ekran yayını 🖥️.

### 4. 💬 Mesaj Logları & Medya Kurtarma
* **Silinen Medyaları Kurtarma:** Silinen fotoğrafları Discord CDN'den kaybolmadan önce log kanalına tekrar yükler.
* **Ghost Ping Avcısı:** 60 saniye içinde etiket atıp silenleri ifşa eder.
* **Mesaj Düzenleme & Toplu Silme (Purge).**

### 5. 👤 Üye & Güvenlik Hareketleri
* Hesap yaşı kontrolü, davet eden kişi tespiti, sahte davet alarmı, isim/rol/timeout logları.
* **Anti-Nuke:** 10 saniyede birden fazla kanal veya rol silmeye kalkan yetkilinin yetkilerini anında sıfırlar.

---

## ⚙️ Kurulum & Yönetim

Sunucunuzda dilediğiniz zaman tek komutla her şeyi yönetin:
```
/ayarlar
```
Açılan menüden hem log kanallarını hem de YouTube/Kick yayıncı duyurularını kolayca yapılandırabilirsiniz.
