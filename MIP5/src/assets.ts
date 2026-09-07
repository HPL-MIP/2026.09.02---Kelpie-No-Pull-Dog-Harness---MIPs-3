import cta from '../Assets/Kelpie/cta.webp';
import design from '../Assets/Kelpie/design.webp';
import handHint from '../Assets/Kelpie/handhint.webp';
import leftArrow from '../Assets/Kelpie/left_arrow.webp';
import logo from '../Assets/Kelpie/logo.webp';
import rightArrow from '../Assets/Kelpie/right_arrow.webp';
import slide1Main from '../Assets/Kelpie/slide1_main.webp';
import slide1Text from '../Assets/Kelpie/slide1_text.webp';
import slide2IconText from '../Assets/Kelpie/slide2_icon_text.webp';
import slide2Icons from '../Assets/Kelpie/slide2_icons.webp';
import slide2Main from '../Assets/Kelpie/slide2_main.webp';
import slide3CaptionLeft from '../Assets/Kelpie/slide3_caption_left.webp';
import slide3CaptionRight from '../Assets/Kelpie/slide3_caption_right.webp';
import slide3LabelLeft from '../Assets/Kelpie/slide3_label_left.webp';
import slide3LabelRight from '../Assets/Kelpie/slide3_label_right.webp';
import slide3Main from '../Assets/Kelpie/slide3_main.webp';
import slide3Text from '../Assets/Kelpie/slide3_text.webp';
import slide4Main from '../Assets/Kelpie/slide4_main.webp';
import slide4Text from '../Assets/Kelpie/slide4_text.webp';
import slide5Headline from '../Assets/Kelpie/slide5_headline.webp';
import slide5Subtext from '../Assets/Kelpie/slide5_subtext.webp';
import slide5Timer from '../Assets/Kelpie/slide5_timer.webp';
import endcardHtml from 'virtual:kelpie-endcard';
import clickSfx from 'virtual:kelpie-click-sfx';
import endSfx from '../Assets/Kelpie/sfx/end.mp3';

export const Assets = {
  cta, design, handHint, leftArrow, logo, rightArrow,
  slide1Main, slide1Text,
  slide2IconText, slide2Icons, slide2Main,
  slide3CaptionLeft, slide3CaptionRight, slide3LabelLeft, slide3LabelRight,
  slide3Main, slide3Text,
  slide4Main, slide4Text,
  slide5Headline, slide5Subtext, slide5Timer,
} as const;

export { endcardHtml };

export const Sounds = { clickSfx, endSfx } as const;

export type AssetKey = keyof typeof Assets;
