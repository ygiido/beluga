# 🐋 Beluga Discord Bot (v0.0.1)

Beluga, topluluk ve kurumsal sunucular için geliştirilmiş; komut ezberletmeyen görsel kontrol paneli, anti-bypass moderasyon motoru, dinamik geçici ses odaları, modal destek (ticket) altyapısı ve 6 kategorili denetim loglarına sahip yeni nesil Discord botudur.

## ✨ Temel Özellikler

1. **🧭 Görsel Kontrol Paneli (`/panel`):**
   * Sekmeli dashboard ve canlı modül durum rozetleri (🟢/🔴).
   * ID kopyalamadan `RoleSelectMenu` ve `ChannelSelectMenu` ile doğrudan seçim.
   * Tek tıkla eksik rolleri ve kanalları kuran **⚡ Hızlı Şablon Kurulumu**.

2. **🛡️ Akıllı Moderasyon, Anti-Bypass & Sicil:**
   * Leetspeak (`0->o`, `1->i`, `@->a`), harf uzatmaları (`siiikkk`) ve noktalı bypass (`s.i.k`) temizleme.
   * Kademeli ceza: 1. ve 2. ihlalde kendini 6 saniyede imha eden uyarı; 3. ihlalde hapis (Jail).
   * Spam koruması: 3 saniyede 4 mesaja 3 dakika timeout; tekrarında Jail.
   * Scam/Phishing kalkanı ve görsel/link spam koruması.
   * Otomatik tahliye döngüsü ve `/sicil` görsel ceza profil kartı.

3. **🎙️ Dinamik Geçici Ses Odaları (Temp Voice):**
   * "➕ Oda Oluştur" kanalına tıklandığında anında özel oda oluşturup kullanıcıyı taşıma.
   * Mesaj tabanlı butonlu kontrol paneli: Kilitle/Aç, Gizle/Göster, Sohbet Kilidi, Güvenilen Üye (Trust), Engelle (Block), Kişi Limiti, Soundboard izinleri ve 5 dk rate-limit korumalı isim değiştirme.
   * Oda kurucusu çıktığında devredilebilir **👑 Sahipliği Al (Claim)** butonu.
   * Boşalan odaların anında imha edilmesi (Sıfır Çöp Prensibi) ve hayalet oda temizliği.

4. **🎫 Ön Formlu (Modal) Destek & Başvuru (Ticket):**
   * Discord Modal pop-up pencereleri ile konu ve detaylı açıklama alma.
   * Yetkili paneli: Talebi Üstlen (Claim), Kilitle/Aç, Üye Ekle/Çıkar, Kapat ve Arşivle.
   * 100 mesaj sınırını aşan transkript motoru ile tüm yazışmaları `.txt` dosyası olarak loglama.
   * Askıda kalma koruması (üye sunucudan ayrıldığında otomatik arşiv) ve 1-5 yıldızlı memnuniyet puanlama.

5. **📜 6 Kategorili Audit Log & Proaktif Güvenlik:**
   * **Silinen Medyaları Kurtarma:** Silinen mesajlardaki görselleri CDN'den silinmeden anında çekip log kanalına kanıt olarak tekrar yükleme.
   * **Ghost Ping Avcısı:** 60 saniye içinde etiket atıp silenleri ifşa etme.
   * **Yetki Kırmızı Alarmı:** Rollerde Administrator, Manage Roles vb. kritik izinler açıldığında acil durum uyarısı.
   * **Anti-Nuke:** 10 saniyede birden fazla kanal veya rol silmeye çalışan yetkilinin rollerini geri alma.
   * Ses mesai takibi (odada geçirilen net süre) ve yeni hesap / 24 saatlik sahte davet tespiti.

## 🚀 Kurulum

1. Depoyu klonlayın:
   ```bash
   git clone https://github.com/ygiido/belugal.git
   cd belugal
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env.example` dosyasını `.env` olarak kopyalayın ve bot tokenınızı girin:
   ```bash
   cp .env.example .env
   ```

4. Botu başlatın:
   ```bash
   npm start
   ```
