/** "theming" catalog, pt. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Alterar aparência",
    title: "Aparência",
    themeLegend: "Tema",
    modeLegend: "Modo",
  },
  modes: {
    light: "Claro",
    dark: "Escuro",
    system: "Sistema",
  },
  themes: {
    horizon: "Horizonte",
    signature: "Assinatura",
    sapphireTide: "Maré Safira",
    emeraldGrove: "Bosque Esmeralda",
    saffronEmber: "Brasa Açafrão",
    roseQuartz: "Quartzo Rosa",
    platinum: "Platina",
  },
  logo: {
    alt: "Logotipo de {name}",
  },
  branding: {
    errors: {
      themeId: "Escolha um dos temas disponíveis.",
      defaultMode: "Escolha o modo claro, escuro ou do sistema.",
      displayName: "Insira um nome de exibição de 1 a {max} caracteres.",
      logoType: "Envie um arquivo SVG ou PNG.",
      logoSize: "O logotipo deve ter {max} KB ou menos.",
      logoHeight: "O logotipo deve ter pelo menos {min} pixels de altura.",
      logoAspect: "A proporção do logotipo (largura : altura) deve estar entre 1:1 e {max}:1.",
      logoUnsafe: "Este SVG contém scripts ou referências externas e não pode ser usado.",
    },
  },
};

export default messages;
