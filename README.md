# Varfarin Doz Asistani

Tarayicida acilan, bagimsiz bir klinik karar destek araci. Amac, kanamasiz ayaktan
varfarin bakim tedavisinde:

- Klinisyenin girdigi mevcut tekrar eden kullanim paternini
- Bugunku INR sonucunu
- Istenirse onceki INR + iki INR arasindaki gercek kullanim bilgisini

kullanarak bir sonraki haftalik doz paternini ve takip INR zamanini onermektir.

## Kapsam

Bu surum bilincli olarak dar kapsamli tasarlandi:

- Ayaktan bakim dozu ayari
- Kanamasiz hasta
- Hedef INR araligi `2.0-3.0` veya `2.5-3.5`
- Tekrarlayan haftalik plan uretimi

Asagidaki durumlarda uygulama otomatik oneriyi durdurur ve ust duzey uyari verir:

- Aktif kanama / melena / hematemez / norolojik alarm semptomu
- `INR >= 5`

## Calistirma

Dosyayi dogrudan acabilirsiniz:

1. [/Users/yh/Documents/Playground/warfarin-doz-asistani/index.html](/Users/yh/Documents/Playground/warfarin-doz-asistani/index.html)

Isterseniz basit bir yerel sunucu da acabilirsiniz:

```bash
cd /Users/yh/Documents/Playground/warfarin-doz-asistani
python3 -m http.server 8080
```

Sonra `http://localhost:8080` adresini ziyaret edin.

## Test

```bash
cd /Users/yh/Documents/Playground/warfarin-doz-asistani
npm test
```

## Literatur ozetleri

Bu uygulamanin klinik cekirdegi dort ana kaynaga dayaniyor:

1. CHEST 2012 ozet kilavuzu:
   Stabil INR ile giden hastalarda INR takibi 12 haftaya kadar acilabilir; onceki INR'leri stabil olan hastada terapotik araligin `<=0.5` disindaki tek sapmada mevcut doz korunup `1-2 hafta` icinde tekrar INR bakilmasi onerilir.
2. UW Medicine varfarin bakim nomogrami:
   Bakim dozunda esas mantik toplam haftalik dozu `yaklasik %5-20` araliginda degistirmektir; hafif dusuk/yuksek INR'de bazen hic degisim gerekmeyebilir, daha yuksek INR'lerde doz atlama / doz tutma dusunulur.
3. Blood Advances 2022:
   Hafif tek sapmada `watchful waiting` stratejisi klinik olarak makul bir secenek olarak desteklenir.
4. Sistematik derleme (2021):
   Warfarin algoritmalarinin buyuk kismi dogrudan genellenebilir veya iyi dis dogrulanmis degildir; bu nedenle burada kara kutu bir model yerine seffaf nomogram tabanli karar mantigi kullanildi.

## Muhendislik notu

Uygulamadaki `onceki INR + ara donem kullanim` mantigi, kilavuzdaki doz ayar bantlarini
daha temkinli veya daha agresif kullanmak icin tasarlanmis bir uygulama karar katmanidir.
Bu kisim ayri bir klinik prediksiyon modeli olarak valide edilmis degildir.
