# Tasks: add-portrait-layout-and-polish

## 1. Портретный режим

- [x] 1.1 layout.ts: computeLayout (landscape 1920×1080 / portrait 1080×1920), мутабельные DESIGN/REELS_AREA/CELL. Verify: typecheck.
- [x] 1.2 main.ts: пересоздание игры при смене режима; Game.destroy снимает тикер и слушатели. Verify: поворот окна в playwright пересоздаёт игру без ошибок консоли.
- [x] 1.3 Game: cover-посадка фона; Ui: портретная раскладка HUD; Paytable: масштаб панели. Verify: скриншот 08-portrait-idle.png — сетка крупная, HUD доступен.
- [x] 1.4 Smoke: портретный спин с проверкой списания ставки. Verify: локально и в CI.

## 2. Тултипы и турбо

- [x] 2.1 Тултипы кнопок (панель над/под кнопкой, clamp по краям, eventMode none). Verify: скриншоты 07-tooltip-*.png.
- [x] 2.2 Турбо-кнопка: текст «ТУРБО» + индикатор ВКЛ/ВЫКЛ + подсветка активного состояния. Verify: скриншот idle.

## 3. Живой огонь

- [x] 3.1 Мерцающие ореолы на точках свечей/кадильниц (два наложенных синуса + scale-дыхание). Verify: визуально на idle-скриншоте.

## 4. Интеграция

- [x] 4.1 Build + smoke (ландшафт + портрет) + скриншоты; validate --strict; archive; push; CI зелёный.
