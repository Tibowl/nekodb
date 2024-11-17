import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats } from "../../utils/tables";

export type SmallCat = {
  id: number;
  name: string;
};

export type Cat = SmallCat & {};

export const getStaticProps = (async (context) => {
  const cat = cats.find((cat) => cat.Id == Number(context.params?.catId));

  if (!cat) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      id: cat.Id,
      name: translate("Cat", `CatName${cat.Id}`, "en"),
    },
  };
}) satisfies GetStaticProps<Cat>;

export const getStaticPaths = (async () => {
  return {
    paths: cats.map((cat) => ({ params: { catId: cat.Id.toString() } })),
    fallback: false,
  };
})


export default function Cat(cat: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div>
      <h1>{cat.name}</h1>
    </div>
  );
}
