import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import CatLink from "../../components/CatLink"
import FormattedLink from "../../components/FormattedLink"
import { Mermaid } from "../../components/Mermaid"
import { CatType } from "../../utils/cat/catType"
import { getCatType } from "../../utils/cat/getCatType"
import { cats, getSmallCat } from "../../utils/tables"
import { SmallCat } from "./[catId]"

type CatList = {
  cats: SmallCat[];
};

export const getStaticProps = (async () => {
  return {
    props: {
      cats: await Promise.all(cats.map(cat => getSmallCat(cat))),
    },
  }
}) satisfies GetStaticProps<CatList>

export default function CatList({
  cats,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Cats - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Cats - NekoDB" />
        <meta property="og:description" content={`Discover all ${cats.length} cats in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${cats.length} cats in Neko Atsume 2!`} />
      </Head>

      <h1 className="text-4xl font-bold">Cats</h1>

      <h2 className="text-xl font-bold">Normal cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Normal).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>

      <h2 className="text-xl font-bold">Rare cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Rare).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>

      <h2 className="text-xl font-bold">Other cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Other || getCatType(cat) == CatType.Myneko).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>

      <h2 className="text-2xl font-bold">Cat selection</h2>
      <div>
        The cat selection is based on several factors, below is a flowchart by <FormattedLink href="https://www.reddit.com/user/Infamous-Shop1615" target="_blank">u/Infamous-Shop1615</FormattedLink> that explains how the game decides which cat to spawn.
      </div>
      <Mermaid chart={`
%%   mermaid-diagram

flowchart TB
subgraph Factors["Game Constants"]
    ExistingCat["Currently Playing Cats at the Goodie"] --> CatRelations["Cat Relationship Modifier<br>aka Cat vs cat weights<br>aka Cat Interaction"]
    DamageState["Goodie Damage State"] --> PlayspaceOnCat["Playspace Cat Attraction Weights<br>aka Cat weights"]
    PlayspaceConflicts["Playspace Conflicting Playspaces<br> aka Conflicts"]
    FoodType["Food Type"] --> Food["Cat Visit Chance<br>aka Food Staying Power<br>aka Cat Food Multiplier"]
    Charm["Playspace Charm"]
    Weather["Weather Condition<br>aka Season"]-->PlayspaceWeather["Playspace Weather Modifier"]
    CatWeather["Cat Seasonal Modifier Factor"]
end

subgraph VisitCalculations["Visit Calculations"]
    CatSelect["Cat Selection<br><br>The algo first selects one cat.<br><br>1. (Compute cat relationship modifier) For each of the cat weight, multply it by (100 + the sum of all the other playing cats' cat vs cat weights)%.<br>2. Do a weighted draw using the new weights."] --> 
    CanCatVisit{"Can this cat visit?<br><br>All conditions below must be true.<br>- Playspace is empty.<br>- Playspace conflicting spaces are empty.<br>- NOT(Playspace is food AND playspace is indoors) (indoor food does not attract cats).<br>- Selected cat is not in cooldown.<br>- Selected cat is not playing in other places."}
    CanCatVisit --> |Yes| VisitProb["Visit Probability<br><br>The game then determines if selected cat will visit.<br><br>The chance is given by (Visit Chance)% <br> * (Playspace Charm)% <br> * (Playspace's weather modifier given season * (Cat's seasonal modifier factor)% + 100)%"]
    VisitProb --> Draw{Draw and decide if the cat is visiting}
end

Start(("For each playspace at each tick"))
Start --> CatSelect
NoVisit([No cat visits])
CanCatVisit --> |No| NoVisit
Draw --> |Yes| Visit([Cat visits])
Draw --> |No| NoVisit
PlayspaceOnCat --> CatSelect
CatRelations --> CatSelect
PlayspaceConflicts --> CanCatVisit
Food --> VisitProb
Charm --> VisitProb
PlayspaceWeather --> VisitProb
CatWeather --> VisitProb`} />
    </main>
  )
}
