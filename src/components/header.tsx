import Image from "next/image";

export default function Header() {
  return (
    <header className="flex flex-col items-center justify-center space-y-2 pb-4">
      <Image
        src="/logo.svg"
        alt="SUPPLY: THE FUTURE - Digital supply chain verification platform logo"
        className="invert dark:invert-0"
        width={70}
        height={70}
        aria-hidden="true"
      />
      <h1 className="font-semibold">SUPPLY: THE FUTURE</h1>
    </header>
  );
}
