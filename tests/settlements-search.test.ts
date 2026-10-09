import { describe, expect, test } from "bun:test";

import { isSearchable, searchSettlements, type Settlement } from "../src/lib/settlements";

const city = (ekatte: number, name: string, population: number): Settlement => ({
  ekatte,
  isVillage: false,
  name,
  municipality: name,
  province: "Пловдив",
  postalCode: "4230",
  population,
});
const village: Settlement = {
  ekatte: 1,
  isVillage: true,
  name: "Бачково",
  municipality: "Асеновград",
  province: "Пловдив",
  postalCode: "4251",
  population: 300,
};

describe("isSearchable", () => {
  const asenovgrad = city(702, "Асеновград", 50186);
  const other = city(99999, "Голям Град", 60000);

  test("големите градове са скрити, освен подготвените", () => {
    expect(isSearchable(other, true)).toBe(false);
    expect(isSearchable(asenovgrad, true)).toBe(true);
  });

  test("малките места и режимът без изключване винаги са видими", () => {
    expect(isSearchable(village, true)).toBe(true);
    expect(isSearchable(other, false)).toBe(true);
  });

  test("градът е преди селата от общината си", () => {
    const res = searchSettlements([village, asenovgrad], "асеновград");
    expect(res[0]?.ekatte).toBe(702);
  });
});
