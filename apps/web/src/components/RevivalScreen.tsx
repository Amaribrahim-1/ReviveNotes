"use client";

import type { Item } from "@revivenotes/shared";
import RevivalRow from "./RevivalRow";
import { mutedClass, titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type RevivalScreenProps = {
  items: Item[];
};

export default function RevivalScreen({ items }: RevivalScreenProps) {
  const { t } = useT();

  return (
    <section className="flex flex-col gap-4" aria-labelledby="revival-title">
      <h1 id="revival-title" className={titleClass}>
        {t("revival_title")}
      </h1>
      <p className={mutedClass}>{t("revival_blurb")}</p>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <RevivalRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
