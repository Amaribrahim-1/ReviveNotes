import type { Item } from "@revivenotes/shared";
import RevivalRow from "./RevivalRow";
import { mutedClass, titleClass } from "@/lib/ui-classes";

type RevivalScreenProps = {
  items: Item[];
};

export default function RevivalScreen({ items }: RevivalScreenProps) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="revival-title">
      <h1 id="revival-title" className={titleClass}>
        ملاحظات قديمة
      </h1>
      <p className={mutedClass}>
        الملاحظات دي عدّى عليها أكتر من 7 أيام من غير لمسة. إحياءها أو احذفها عشان تكمل.
      </p>
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
