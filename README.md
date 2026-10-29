# 🐋 Beluga Ultra Logger, Stream Alerts & Moderation (v0.0.1)

Beluga, Discord sunucunuzdaki tüm hareketleri kaydeden, **YouTube & Kick** canlı yayınlarını duyuran, **uyarısız reklam/link engelleyici**, **katlanan timeout** ve **pratik sohbet yönetim komutlarına** sahip hepsi bir arada Discord botudur.

## 🎯 Özellikler

### 1. 🧹 Pratik Sohbet & Yetkili Komutları
* **`/temizle [miktar] [kullanici: opsiyonel]`:** 
  * Kanalda 1-100 arası mesajı anında siler.
  * Eğer `kullanici` seçilirse yalnızca o üyenin mesajlarını temizler.
* **`/kilit [durum: kilitle / aç]`:** 
  * Bulunulan kanalı tek tıkla `@everyone` için mesaj yazmaya kapatır veya açar.
* **`/yavas-mod [saniye]`:** 
  * Kanal sohbet akış hızını sınırlar (0 = Kapalı).
* **`/af [kullanici]`:** 
  * Üyenin aktif zaman aşımı cezasını kaldırır.
  * Küfür/spam ve reklam katlanan ihlal sayaçlarını sıfırlar.

### 2. 🚫 Uyarısız Anti-Reklam & Link Engelleyici (3. İhlalde Kick)
* Discord davet linkleri ve harici web sitelerini uyarısız siler.
* **Kademeli Ceza:**
  * 1. Reklam: 1 Saat Timeout.
  * 2. Reklam: 24 Saat Timeout.
  * 3. Reklam: **Sunucudan Doğrudan Atılır (KICK)!**
* Log kanalına detaylı kanıt raporu bırakır.

### 3. 🛡️ Akıllı Auto-Moderation & Katlanan Timeout
* Küfür, spam ve flood durumunda Discord yerel timeout'u uygulanır.
* Süre **20 dakikadan** başlar ve her tekrarda 2 katına katlanır (20dk ➔ 40dk ➔ 80dk ➔ 160dk...).
* 8 saniyede kendini imha eden uyarı mesajı gönderir.

### 4. 🔴 Canlı Yayın Duyuru Motoru (YouTube & Kick)
* Eklenen kanalları periyodik tarar, yayın başladığı an minimal şık embed atar.
* Yayıncı kapak görseli, canlı izleyici, kategori ve **"▶️ Yayını İzle"** link butonu.
* Opsiyonel `@everyone`, `@here` veya özel rol etiketleme.

### 5. 🎙️ Ses, Mikrofon & Kamera Logları
* Odaya katıldı / ayrıldı / kanal değiştirdi.
* **Net Mesai Süresi:** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
* Mikrofon kapatma/açma 🔇🎙️, kulaklık kapatma/açma 🎧🔊, kamera 📹📷, ekran yayını 🖥️.

### 6. 💬 Mesaj Logları & Medya Kurtarma
* **Silinen Medyaları Kurtarma:** Silinen fotoğrafları Discord CDN'den kaybolmadan önce log kanalına tekrar yükler.
* **Ghost Ping Avcısı:** 60 saniye içinde etiket atıp silenleri ifşa eder.
* **Mesaj Düzenleme & Toplu Silme (Purge).**

---

## ⚙️ Kurulum & Yönetim

Sunucunuzda dilediğiniz zaman tek komutla her şeyi yönetin:
```
/ayarlar
```
Açılan sade panelden koruma kalkanlarını açıp kapatabilir, log kanallarını eşleştirebilir ve yayıncı listesini düzenleyebilirsiniz.
