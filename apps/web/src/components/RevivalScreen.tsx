"use client";

import type { Item } from "@revivenotes/shared";
import RevivalRow from "./RevivalRow";
import { boardClass, mutedClass, titleClass } from "@/lib/ui-classes";
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
      <ul className={boardClass}>
        {items.map((item, index) => (
          <li key={item.id}>
            <RevivalRow item={item} index={index} />
          </li>
        ))}
      </ul>
    </section>
  );
}
