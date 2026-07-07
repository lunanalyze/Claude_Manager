# UI 표준 — Image

> 이미지 자체엔 룩 선택지가 적지만, **아바타 모양(서클·라운디드·스퀘어·링)은
> [UI 표준 워크숍](./index.md)의 `avatar` 선택을 따른다.** 이 문서는 `next/image`·alt·CLS·포맷 등
> 사용 규칙을 다룬다.

## 기본: next/image

- 래스터 이미지는 **`next/image`** 의 `<Image>` 를 기본으로 사용(최적화·lazy·CRLF 방지).
  ```tsx
  import Image from "next/image";
  <Image src="/hero.png" alt="대시보드 미리보기" width={1200} height={630} />
  ```
- 외부 도메인 이미지는 `next.config` 의 `images.remotePatterns` 에 허용 도메인 명시.
- 레이아웃 폭에 맞추려면 `fill` + 부모 `relative` + `sizes` 지정(반응형 최적화).

## 규칙

- **`alt` 필수.** 의미 있는 이미지는 내용 서술, 순수 장식이면 `alt=""`(빈 문자열).
- **CLS 방지**: `width/height` 또는 `fill`+`aspect-[16/9]` 등으로 비율 고정. 무치수 `<img>` 금지.
- **포맷**: 사진은 WebP/AVIF 우선(next/image 자동), 투명/로고는 PNG, **아이콘·단순 도형은 SVG**.
- **아이콘**은 이미지가 아니라 아이콘 컴포넌트(`lucide-react` 권장)로. 크기 `size-4`/`size-5`.
- **반경·테두리**: 썸네일/아바타는 토큰 반경(`rounded-md`/`rounded-full`), 테두리 `border-border`.
- 큰 히어로/배경은 우선 로드가 필요하면 `priority`, 그 외는 기본 lazy 유지.

## 아바타

- 사용자 아바타는 shadcn `Avatar`(이미지 + 폴백 이니셜) 사용. 이미지 실패 시 이니셜 폴백.

```tsx
<div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border">
  <Image src={src} alt={title} fill sizes="(max-width:768px) 100vw, 50vw"
         className="object-cover" />
</div>
```
