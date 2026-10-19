/** "theming" catalog, ru. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Изменить оформление",
    title: "Оформление",
    themeLegend: "Тема",
    modeLegend: "Режим",
  },
  modes: {
    light: "Светлый",
    dark: "Тёмный",
    system: "Системный",
  },
  themes: {
    horizon: "Горизонт",
    signature: "Фирменная",
    sapphireTide: "Сапфировый прилив",
    emeraldGrove: "Изумрудная роща",
    saffronEmber: "Шафрановый уголь",
    roseQuartz: "Розовый кварц",
    platinum: "Платина",
  },
  logo: {
    alt: "Логотип {name}",
  },
  branding: {
    errors: {
      themeId: "Выберите одну из доступных тем.",
      defaultMode: "Выберите светлый, тёмный или системный режим.",
      displayName: "Введите отображаемое имя длиной от 1 до {max} символов.",
      logoType: "Загрузите файл SVG или PNG.",
      logoSize: "Размер логотипа не должен превышать {max} КБ.",
      logoHeight: "Высота логотипа должна быть не менее {min} пикселей.",
      logoAspect: "Соотношение сторон логотипа (ширина : высота) должно быть от 1:1 до {max}:1.",
      logoUnsafe: "Этот SVG содержит скрипты или внешние ссылки и не может быть использован.",
    },
  },
};

export default messages;
