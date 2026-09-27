import Image from "next/image";

type AppLogoProps = {
  size: number;
};

/**
 * Reads the same file as the favicon (`src/app/icon.svg`, served at `/icon.svg`).
 * The alt is empty because the app name is always written next to it.
 */
export default function AppLogo({ size }: AppLogoProps) {
  return <Image src="/icon.svg" alt="" width={size} height={size} className="shrink-0" />;
}
