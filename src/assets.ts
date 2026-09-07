import cta from '../Assets/Kelpie/cta.png';
import bg from '../Assets/Kelpie/bg-runtime.webp';
import scene4Background from '../Assets/Kelpie/bg_scene4-runtime.webp';
import handHint from '../Assets/Kelpie/handhint.png';
import leftArrow from '../Assets/Kelpie/left_arrow.png';
import logo from '../Assets/Kelpie/logo.png';
import rightArrow from '../Assets/Kelpie/right_arrow.png';
import scene1Main from '../Assets/Kelpie/scene1_main.png';
import scene1Text from '../Assets/Kelpie/scene1_text.png';
import scene2Main from '../Assets/Kelpie/scene2_main.png';
import scene2Text from '../Assets/Kelpie/scene2_text.png';
import scene3Main from '../Assets/Kelpie/scene3_main.png';
import scene4Icon0 from '../Assets/Kelpie/scene4_icon0.png';
import scene4Icon1 from '../Assets/Kelpie/scene4_icon1.png';
import scene4Icon2 from '../Assets/Kelpie/scene4_icon2.png';
import scene4Icon3 from '../Assets/Kelpie/scene4_icon3.png';
import scene4Text0 from '../Assets/Kelpie/scene4_text0.png';
import scene4Text1 from '../Assets/Kelpie/scene4_text1.png';
import scene4Text2 from '../Assets/Kelpie/scene4_text2.png';
import scene4Text3 from '../Assets/Kelpie/scene4_text3.png';
import scene5Text from '../Assets/Kelpie/scene5_text.png';
import scene5Timer from '../Assets/Kelpie/scene5_timer.png';
import endcardHtml from 'virtual:kelpie-endcard';
import clickSfx from 'virtual:kelpie-click-sfx';
import endSfx from '../Assets/Kelpie/sfx/end.mp3';

export const Assets = {
  bg, cta, handHint, leftArrow, logo, rightArrow, scene1Main, scene1Text,
  scene2Main, scene2Text, scene3Main, scene4Icon0, scene4Icon1, scene4Icon2,
  scene4Icon3, scene4Text0, scene4Text1, scene4Text2, scene4Text3,
  scene4Background, scene5Text, scene5Timer,
} as const;

export { endcardHtml };

export const Sounds = { clickSfx, endSfx } as const;

export type AssetKey = keyof typeof Assets;
