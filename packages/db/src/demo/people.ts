// Fictional Liberian people for the demo seed (SPEC.md 11.4). Names are combined at
// random; surnames of well-known public figures are left out so no combination
// describes a real person on purpose.
import type { Random } from "./random.ts";

const FEMALE = [
  "Ama",
  "Annie",
  "Bendu",
  "Comfort",
  "Decontee",
  "Esther",
  "Fatu",
  "Felecia",
  "Finda",
  "Garmai",
  "Hannah",
  "Hawa",
  "Jartu",
  "Josephine",
  "Korpo",
  "Kumba",
  "Leemu",
  "Mamie",
  "Martha",
  "Massa",
  "Mercy",
  "Musu",
  "Nyenpu",
  "Oretha",
  "Patience",
  "Precious",
  "Rebecca",
  "Sarah",
  "Satta",
  "Siah",
  "Tenneh",
  "Teta",
  "Victoria",
  "Watta",
  "Weade",
  "Yamah",
  "Yassah",
  "Zoe",
] as const;

const MALE = [
  "Abraham",
  "Alieu",
  "Augustine",
  "Benedict",
  "Boima",
  "Darius",
  "Edwin",
  "Emmanuel",
  "Flomo",
  "Francis",
  "Gbessay",
  "Isaac",
  "Jeremiah",
  "Joseph",
  "Lawrence",
  "Momo",
  "Morris",
  "Moses",
  "Musa",
  "Nathaniel",
  "Oliver",
  "Patrick",
  "Prince",
  "Richard",
  "Samuel",
  "Saye",
  "Sekou",
  "Stephen",
  "Tarnue",
  "Thomas",
  "Varney",
  "Wilmot",
  "Zubah",
] as const;

const SURNAMES = [
  "Barclay",
  "Cole",
  "Cooper",
  "Dennis",
  "Doe",
  "Dolo",
  "Fahnbulleh",
  "Flomo",
  "Freeman",
  "Garnett",
  "Gray",
  "Harris",
  "Howard",
  "Jallah",
  "Kamara",
  "Karnga",
  "Kiazolu",
  "Kollie",
  "Kpadeh",
  "Kpoto",
  "Kromah",
  "Massaquoi",
  "Morris",
  "Mulbah",
  "Nagbe",
  "Nyumah",
  "Pewee",
  "Quaye",
  "Sackor",
  "Sumo",
  "Tamba",
  "Tarr",
  "Toe",
  "Varney",
  "Wleh",
  "Yarkpawolo",
  "Zayzay",
  "Zinnah",
] as const;

const PLACES = [
  "Sinkor, Monrovia",
  "Congo Town, Monrovia",
  "Duala, Monrovia",
  "New Kru Town, Monrovia",
  "Logan Town, Monrovia",
  "Red Light, Paynesville",
  "ELWA Junction, Paynesville",
  "Gardnersville",
  "Johnsonville",
  "Brewerville",
  "Kakata, Margibi County",
  "Gbarnga, Bong County",
  "Buchanan, Grand Bassa County",
  "Ganta, Nimba County",
  "Tubmanburg, Bomi County",
  "Harper, Maryland County",
  "Voinjama, Lofa County",
  "Zwedru, Grand Gedeh County",
] as const;

export type Sex = "female" | "male";

export type Person = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: Sex;
};

export function person(random: Random, lastName?: string): Person {
  const sex: Sex = random.chance(0.5) ? "female" : "male";
  const names = sex === "female" ? FEMALE : MALE;
  return {
    firstName: random.pick(names),
    middleName: random.chance(0.3) ? random.pick(names) : null,
    lastName: lastName ?? random.pick(SURNAMES),
    sex,
  };
}

/** Parent's first name for a guardian of the given sex. */
export function firstName(random: Random, sex: Sex): string {
  return random.pick(sex === "female" ? FEMALE : MALE);
}

export function address(random: Random): string {
  return random.pick(PLACES);
}

/** Liberian mobile number in the 077, 088 or 055 ranges. */
export function phone(random: Random): string {
  const prefix = random.pick(["77", "88", "55"]);
  return `+231 ${prefix}${random.int(0, 9)} ${random.int(100, 999)} ${random.int(100, 999)}`;
}
