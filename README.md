# 🐋 Beluga Ultra Logger (v0.0.1)

Beluga, Discord sunucunuzdaki her türlü hareketi (ses, mikrofon, kamera, yayın, silinen görseller, ghost pingler, roller, kanallar vb.) milisaniyesine kadar takip edip kaydeden yeni nesil, proaktif bir denetim ve güvenlik botudur.

## 🎯 Ne Yapar? (Kapsamlı Log Yetenekleri)

### 1. 🎙️ Ses, Mikrofon & Kamera Logları (`#ses-log`)
* **Odaya Katılma / Ayrılma:** Kim hangi odaya girdi, hangi odadan çıktı.
* **Geçirilen Net Süre (Mesai):** Odadan çıkışta tam süre hesabı (`⏱️ 1 saat 24 dakika 15 saniye`).
* **Oda Değişimi:** Hangi odadan hangi odaya geçti.
* **Mikrofon:** Kendi mikrofonunu kapattı (Mute) 🔇 veya açtı 🎙️.
* **Kulaklık:** Kulaklığını kapattı (Deafen) 🎧 veya açtı 🔊.
* **Sunucu Müdahalesi:** Yetkili tarafından susturuldu (Server Mute) veya sağırlaştırıldı.
* **Kamera:** Kamerasını açtı 📹 veya kapattı 📷.
* **Ekran/Oyun Yayını:** Yayın başlattı 🖥️ veya durdurdu.

### 2. 💬 Mesaj Logları & Medya Kurtarma (`#mesaj-log` & `#medya-kurtarma`)
* **Silinen Medyaları Kurtarma:** Silinen fotoğraf, video veya dosyaları Discord CDN'den kaybolmadan önce yakalayıp log kanalına kanıt dosyası olarak yükler.
* **Ghost Ping (Hayalet Etiket) Tespiti:** Birini etiketleyip ilk 60 saniye içinde mesajını silenleri ifşa eder.
* **Mesaj Düzenleme:** Eski ve yeni halini gösterir, mesaja doğrudan gitme bağlantısı verir.
* **Toplu Mesaj Silme (Purge):** Silinen mesaj adedini ve işlemi yapan yetkiliyi gösterir.

### 3. 👤 Üye Hareketleri Logu (`#üye-log`)
* **Yeni Katılanlar:** Hesap yaşı hesabı (günlük), davet eden kişi ve kullanılan davet kodu.
* **Ayrılanlar:** Sunucuda kaldığı toplam süre ve ayrılırken sahip olduğu roller.
* **Sahte Davet Tespiti:** Sunucuya girip 24 saat dolmadan ayrılan hesapları kırmızı alarm olarak işaretler.
* **İsim Değişimi:** Sunucu takma adını (nickname) değiştirenleri kaydeder.
* **Rol Değişimleri:** Üyeye hangi rolün verildiğini/alındığını ve bunu hangi yetkilinin yaptığını Audit Log üzerinden yakalar.
* **Zaman Aşımı (Timeout):** Süresi, sebebi ve işlemi yapan yetkiliyle birlikte listelenir.
* **Ban / Unban:** Yasaklama veya af işlemi, sebebi ve yetkilisiyle kaydedilir.

### 4. 🏛️ Sunucu, Kanal & Rol Logları (`#sunucu-kanal-rol-log`)
* Kanal açma, silme ve isim güncellemeleri.
* Rol açma, silme ve renk/isim güncellemeleri.
* Tüm işlemleri yapan yetkililer Audit Log ile tespit edilir.

### 5. 🚨 Güvenlik & Kırmızı Alarmlar (`#güvenlik-alarm-log`)
* **Kritik Rol İzni Kırmızı Alarmı:** Bir role Yönetici, Ban, Kick yetkisi verildiğinde `@everyone` etiketli acil durum bildirimi fırlatır.
* **Anti-Nuke:** 10 saniye içinde birden fazla kanal veya rol silmeye kalkan yetkilinin yetkilerini anında sıfırlar ve sunucu sahibini uyarır.
* **Şüpheli Hesap Alarmı:** Oluşturulma tarihi 15 günden yeni olan hesaplar girdiğinde sarı risk uyarısı verir.

---

## ⚡ Kurulum & Başlatma

1. Kanalları otomatik oluşturmak için yetkili kanalda:
   ```
   /log-kur
   ```
   *(Tek tıkla `@everyone` rolüne gizli 6 kanallı kategoriyi kurar)*
2. Dilerseniz mevcut kanallarınızı bağlamak için:
   ```
   /log-ayarla tur:[kategori] kanal:[#kanal]
   ```
