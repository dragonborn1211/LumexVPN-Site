# LumexVPN — сайт

Статический сайт на GitHub Pages. Сейчас: заглушка-лендинг (`index.html`) + политика конфиденциальности (`privacy/`), синхронизированная с текстом из `lumex_vpn/lib/features/settings/privacy_policy_content.dart`.

## Как включить GitHub Pages

1. Settings → Pages в этом репозитории.
2. Source: `Deploy from a branch`, branch `main`, папка `/ (root)`.
3. Сохранить — через минуту сайт будет доступен на `https://dragonborn1211.github.io/LumexVPN-Site/`.

## Как подключить домен lumexvpn.com

1. В настройках DNS у регистратора домена добавить записи, чтобы `lumexvpn.com` указывал на GitHub Pages:
   - Для apex-домена (`lumexvpn.com`) — четыре `A`-записи на IP GitHub Pages:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - Если нужен ещё и `www.lumexvpn.com` — `CNAME`-запись `www` → `dragonborn1211.github.io`.
2. В Settings → Pages этого репозитория в поле Custom domain указать `lumexvpn.com` (файл `CNAME` в репозитории уже это подсказывает GitHub Pages).
3. Дождаться проверки DNS (обычно от пары минут до нескольких часов) и включить "Enforce HTTPS" в тех же настройках, как только чекбокс станет доступен.

Если API (`api.lumexvpn.com`) уже занимает поддомен на другом сервере — это не конфликтует: `A`-записи ставятся только на сам apex `lumexvpn.com`, `api.` поддомен остаётся как есть.

## Ссылка для Google Play Console

После подключения домена — `https://lumexvpn.com/privacy/` (до этого момента можно временно указать `https://dragonborn1211.github.io/LumexVPN-Site/privacy/`, обе страницы идентичны).
