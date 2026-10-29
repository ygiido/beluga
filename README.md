# 🐋 Beluga Ultra Logger, Moderation & Temp Voice (v0.0.1)

Beluga; Discord sunucunuzdaki tüm hareketleri kaydeden, **YouTube & Kick** canlı yayınlarını duyuran, **uyarısız reklam engeli**, **katlanan timeout**, **pratik sohbet komutları**, **sadece-medya kanalları** ve **hem butonlu hem menülü geçici ses odalarına (Temp Voice)** sahip hepsi bir arada Discord botudur.

## 🎯 Özellikler

### 1. 🎙️ Dinamik Geçici Ses Odaları (Temp Voice)
* **Tıkla-Oluştur:** Belirlenen ana odaya tıklandığı an üyeye özel geçici ses kanalı açılır ve üye otomatik içine taşınır.
* **Hem Menülü Hem Butonlu Oda İçi Kontrol Paneli:**
  * Açılan yeni ses odasının dahili metin sohbetine sabit bir kontrol paneli mesajı atılır.
  * **Açılır Menü (Select Menu):** Kilitle/Aç, Gizle/Göster, Kişi Limiti, Güvenilen Üye Ekle (Trust), Üye Engelle (Block), İsim Değiştir (Modal).
  * **Hızlı Butonlar:** Kilit, Gizle, Limit, İsim değiştirme butonları.
  * **Sahipliği Al (Claim):** Oda kurucusu çıktığında odada kalan üyeler için beliren devretme butonu.
* **Sıfır Çöp Prensibi:** Odadaki son kişi çıktığı an oda Discord'dan anında silinir.

### 2. 📸 Sadece-Medya Kanalları (Media-Only)
* `/ayarlar` menüsünden dilediğiniz kanalları "Sadece-Medya" olarak işaretleyebilirsiniz.
* Bu kanallara gönderilen mesajlarda **fotoğraf, video veya medya linki (GIF vb.) yoksa** bot mesajı anında siler ve geçici uyarı verir.

### 3. 🧹 Pratik Sohbet Komutları
* **`/temizle [miktar] [kullanici: opsiyonel]`:** 1-100 arası mesajı anında siler.
* **`/kilit [durum: kilitle / aç]`:** Kanalı tek tıkla mesaj yazmaya kapatır veya açar.
* **`/yavas-mod [saniye]`:** Kanal sohbet hızını sınırlar.
* **`/af [kullanici]`:** Üyenin cezasını kaldırır ve ceza sayaçlarını sıfırlar.

### 4. 🚫 Uyarısız Anti-Reklam & Link Engelleyici (3. İhlalde Kick)
* Davet linkleri ve harici web sitelerini uyarısız siler.
* 1. Reklam: 1 Saat Timeout, 2. Reklam: 24 Saat Timeout, 3. Reklam: **Sunucudan Atılır (Kick)**.

### 5. 🛡️ Akıllı Auto-Moderation & Katlanan Timeout
* Küfür, spam ve flood durumunda ceza 20 dakikadan başlar ve her tekrarda katlanır (20dk ➔ 40dk ➔ 80dk...).

### 6. 🔴 Canlı Yayın Duyuru Motoru (YouTube & Kick)
* Eklenen kanalları periyodik tarar, yayın başladığı an minimal şık embed atar.
* **"▶️ Yayını İzle"** doğrudan link butonu.

### 7. 📜 Ultra Detaylı 6 Kategorili Log & Medya Kurtarma
* Silinen medyaları CDN'den kurtarma, ghost ping tespiti, ses mesai takibi, üye hareketleri ve anti-nuke.

---

## ⚙️ Kurulum & Yönetim

Sunucunuzda tek komutla her şeyi yönetin:
```
/ayarlar
```
Açılan menüden;
* **`🎙️ Geçici Ses Odaları`** kısmından oda açacak tetikleyici kanalı seçebilir,
* **`📸 Sadece-Medya Kanalları`** kısmından kanalları ekleyip çıkarabilirsiniz!
