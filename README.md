# 🐋 Beluga Ultra Logger (v0.0.1)

Beluga, Discord sunucunuzdaki her türlü hareketi (ses, mikrofon, kamera, yayın, silinen görseller, ghost pingler, roller, kanallar vb.) anlık olarak takip edip kaydeden yeni nesil denetim botudur.

## 🎯 Özellikler (Kapsamlı Log Yetenekleri)

1. **🎙️ Ses, Mikrofon & Kamera Logları:**
   * Odaya katıldı / odadan ayrıldı.
   * **Net Süre Hesabı:** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
   * **Kanal Değişimi:** Hangi odadan hangi odaya geçti.
   * **Mikrofon:** Kendi mikrofonunu kapattı (Mute) 🔇 / açtı 🎙️.
   * **Kulaklık:** Kulaklığını kapattı (Deafen) 🎧 / açtı 🔊.
   * **Sunucu Müdahalesi:** Yetkili tarafından susturuldu / sağırlaştırıldı.
   * **Kamera:** Kamerasını açtı 📹 / kapattı 📷.
   * **Yayın:** Ekran veya oyun yayını başlattı 🖥️ / durdurdu.

2. **💬 Mesaj Logları & Medya Kurtarma:**
   * **Silinen Medyaları Kurtarma:** Silinen fotoğraf, video veya dosyaları Discord CDN'den silinmeden önce yakalayıp log kanalına yükler.
   * **Ghost Ping Avcısı:** Birini etiketleyip ilk 60 saniye içinde mesajını silenleri ifşa eder.
   * **Mesaj Düzenleme:** Eski ve yeni halini gösterir, mesaja gitme linki verir.
   * **Toplu Silme (Purge):** Silinen mesaj adedini ve yetkiliyi gösterir.

3. **👤 Üye Hareketleri Logu:**
   * Giriş yapanın hesap yaşı (günlük) ve davet eden kişi / davet kodu.
   * Sunucudan ayrılan üyenin kaldığı süre ve ayrılırkenki rolleri.
   * **Sahte Davet:** 24 saat dolmadan çıkan hesapları işaretler.
   * İsim/nickname değişiklikleri, rol alıp verme (Audit Log ile yapan yetkili), Timeout ve Ban/Unban.

4. **🏛️ Sunucu, Kanal & Rol:**
   * Kanal ve rol oluşturma, silme veya isim/renk değişiklikleri (Audit Log yetkilisiyle birlikte).

5. **🚨 Güvenlik Alarmları:**
   * **Kritik Rol İzni Kırmızı Alarmı:** Bir role Yönetici, Ban, Kick gibi yetkiler verildiğinde `@everyone` etiketli acil durum bildirimi.
   * **Anti-Nuke:** 10 saniyede birden fazla kanal/rol silmeye kalkan yetkilinin yetkilerini sıfırlar.
   * **Şüpheli Hesap:** 15 günden yeni hesaplara sarı risk uyarısı verir.

---

## ⚙️ Kurulum & Kullanım

Bot sunucuya eklendikten sonra yetkili bir kanalda şu komutu çalıştırın:
```
/ayarlar
```
Açılan menüden dilediğiniz log kategorisini seçip sunucunuzdaki mevcut metin kanalını tek tıkla bağlayabilirsiniz!
