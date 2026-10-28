# 🐋 Beluga Ultra Logger, Stream Alerts & Anti-Ad System (v0.0.1)

Beluga, Discord sunucunuzdaki her türlü hareketi kaydeden, **YouTube & Kick** canlı yayınlarını duyuran, **uyarısız reklam/link engelleyici** ve **katlanan timeout** motoruna sahip yeni nesil bir Discord botudur.

## 🎯 Özellikler

### 1. 🚫 Uyarısız Anti-Reklam & Link Engelleyici (3. İhlalde Kick)
* **Kapsam:** Discord sunucu davet linkleri (`discord.gg/...`, `discord.com/invite/...`, `dsc.gg/...`), tüm harici web linkleri (`http`, `https`, `www`, `.com`, `.net`, `.xyz`, `.gg` vb.) ve araya nokta/boşluk koyularak yapılan bypass taktikleri (`discord(.)gg`, `site dot com`).
* **Uyarısız Çalışma Prensibi:** Sohbette gereksiz kirlilik yaratmamak için kanala hiçbir uyarı mesajı atılmaz; mesaj anında sessizce silinir ve Discord'un yerel ceza motoru devreye girer.
* **Kademeli Ceza:**
  * **1. Reklam:** Mesaj silinir ➔ **1 Saat Discord Timeout (Zaman Aşımı)**.
  * **2. Reklam:** Mesaj silinir ➔ **24 Saat (1 Gün) Timeout**.
  * **3. Reklam:** Mesaj silinir ➔ **Sunucudan Derhal Atılır (KICK)!**
* **Detaylı Güvenlik Logu:** Engellenen link, kullanıcının bilgileri ve uygulanan ceza anında `#güvenlik-alarm-log` veya `#üye-log` kanalına kanıt olarak iletilir.
* Yetkililer (`ManageMessages` veya `Administrator`) muaftır.

### 2. 🛡️ Akıllı Auto-Moderation & Katlanan Timeout
* Küfür, spam ve flood durumunda Discord yerel timeout'u uygulanır.
* Süre **20 dakikadan** başlar ve her tekrarda 2 katına katlanır (20dk ➔ 40dk ➔ 80dk ➔ 160dk...).
* 8 saniyede kendini imha eden uyarı mesajı ve log kaydı oluşturur.

### 3. 🔴 Canlı Yayın Duyuru Motoru (YouTube & Kick)
* Eklenen kanalları periyodik tarar, yayın başladığı an butonlu estetik embed atar.
* Yayıncı kapak görseli, canlı izleyici, kategori ve **"🔴 Yayına Katıl ve İzle"** link butonu.
* Opsiyonel `@everyone`, `@here` veya özel rol etiketleme.

### 4. 🎙️ Ses, Mikrofon & Kamera Logları
* Odaya katıldı / ayrıldı / kanal değiştirdi.
* **Net Mesai Süresi:** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
* Mikrofon kapatma/açma 🔇🎙️, kulaklık kapatma/açma 🎧🔊, kamera 📹📷, ekran yayını 🖥️.

### 5. 💬 Mesaj Logları & Medya Kurtarma
* **Silinen Medyaları Kurtarma:** Silinen fotoğrafları Discord CDN'den kaybolmadan önce log kanalına tekrar yükler.
* **Ghost Ping Avcısı:** 60 saniye içinde etiket atıp silenleri ifşa eder.
* **Mesaj Düzenleme & Toplu Silme (Purge).**

### 6. 👤 Üye & Güvenlik Hareketleri
* Hesap yaşı kontrolü, davet eden kişi tespiti, sahte davet alarmı, isim/rol/timeout logları.
* **Anti-Nuke:** 10 saniyede birden fazla kanal veya rol silmeye kalkan yetkilinin yetkilerini anında sıfırlar.

---

## ⚙️ Kurulum & Yönetim

Sunucunuzda dilediğiniz zaman tek komutla her şeyi yönetin:
```
/ayarlar
```
Açılan menüden hem log kanallarını hem de YouTube/Kick yayıncı duyurularını kolayca yapılandırabilirsiniz.
