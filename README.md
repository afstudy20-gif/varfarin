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

## Yerel calistirma

Dosyayi dogrudan acabilirsiniz:

1. [/Users/yh/Documents/Playground/warfarin-doz-asistani/index.html](/Users/yh/Documents/Playground/warfarin-doz-asistani/index.html)

Isterseniz basit bir yerel sunucu da acabilirsiniz:

```bash
cd /Users/yh/Documents/Playground/warfarin-doz-asistani
python3 -m http.server 8080
```

Sonra `http://localhost:8080` adresini ziyaret edin.

## Coolify deployment

Bu repo artik Coolify icin iki farkli yolla hazir:

1. Onerilen yol: `Dockerfile` build pack
2. Alternatif yol: `Static` build pack

### Onerilen: Dockerfile build pack

Repoya `Dockerfile`, `.dockerignore` ve `nginx/default.conf` eklendi. Bu yapi,
uygulamayi Nginx ile container icinde sunar ve `healthz` endpoint'i verir.

Coolify ayarlari:

- Repository: `https://github.com/afstudy20-gif/varfarin`
- Branch: `main`
- Build Pack: `Dockerfile`
- Base Directory: `/`
- Port: `8080`
- Environment variables: gerekmez

Coolify ekraninda:

1. `Create New Resource`
2. Repo baglayin
3. Build pack olarak `Dockerfile` secin
4. Base Directory alanina `/` girin
5. Network/Port alanini `8080` yapin
6. Domain ekleyip deploy edin

Bu secenegi onermemin nedeni, build ve runtime davranisinin repo icinde net ve
tekrar edilebilir olmasi.

### Alternatif: Static build pack

Coolify'nin resmi dokumanina gore Static build pack, zaten hazir olan HTML/CSS/JS
dosyalarini dogrudan web sunucusuyla yayinlayabilir. Bu proje de zaten build gerektirmeyen
hazir statik dosyalardan olustugu icin bu secenek de uygundur.

Coolify ayarlari:

- Build Pack: `Static`
- Base Directory: `/`
- Web server: varsayilan `Nginx`

Bu yolda Dockerfile kullanmaniz gerekmez. Ancak bu repoda Dockerfile da birakildi;
boylece iki yol arasinda secim yapabilirsiniz.

## Test

```bash
cd /Users/yh/Documents/Playground/warfarin-doz-asistani
npm test
```

## Container dosyalari

- `Dockerfile`: Coolify Dockerfile build pack ile kullanilir
- `nginx/default.conf`: `8080` portunda Nginx sunucusu ve `/healthz` endpoint'i
- `.dockerignore`: gereksiz dosyalari image disinda tutar

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

## Coolify kaynaklari

- Dockerfile Build Pack: https://coolify.io/docs/applications/build-packs/dockerfile
- Static Build Pack: https://coolify.io/docs/builds/packs/static
- Applications ayarlari: https://coolify.io/docs/applications/
