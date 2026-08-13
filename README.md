# LumexVPN — сайт

Статический сайт на GitHub Pages. Сейчас: заглушка-лендинг (`index.html`) + политика конфиденциальности (`privacy/`), синхронизированная с текстом из `lumex_vpn/lib/features/settings/privacy_policy_content.dart`.

## Как включить GitHub Pages

1. Settings → Pages в этом репозитории.
2. Source: `Deploy from a branch`, branch `main`, папка `/ (root)`.
3. Сохранить — через минуту сайт будет доступен на `https://dragonborn1211.github.io/LumexVPN-Site/`.

## Как подключить домен www.lumexvpn.com

**Важно:** сайт живёт на `www.lumexvpn.com`, НЕ на голом `lumexvpn.com` — apex-домен уже занят под VPN-инфраструктуру (front-сервер `62.77.152.215`, см. `frontServerAddress`/`vpnHostname` в `lumex_vpn/lib/core/config/app_config_provider.dart`). Указывать A-записи GitHub Pages на apex **нельзя** — это ломает VPN.

1. В DNS (Cloudflare) добавить только одну запись:
   ```
   Type: CNAME
   Name: www
   Target: dragonborn1211.github.io
   Proxy status: DNS only (серое облако)
   ```
2. Apex `lumexvpn.com` не трогать — там остаётся A-запись на `62.77.152.215` (VPN front).
3. В Settings → Pages этого репозитория в поле Custom domain указать `www.lumexvpn.com` (файл `CNAME` в репозитории уже это подсказывает GitHub Pages).
4. Дождаться проверки DNS и включить "Enforce HTTPS", как только чекбокс станет доступен.

## Ссылка для Google Play Console

После подключения — `https://www.lumexvpn.com/privacy/` (до этого момента можно временно указать `https://dragonborn1211.github.io/LumexVPN-Site/privacy/`, обе страницы идентичны).
