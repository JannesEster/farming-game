import { animalDetailCopy, animalListLine, filterAnimals, TOLLY_OVER_300, type AnimalFilter } from "../sim/animals";
import type { AnimalRecord } from "../sim/storyTypes";
import type { GameState } from "../sim/types";

export type AnimalFilterId = "all" | "tolly300" | "out";

export function filterForPreset(id: AnimalFilterId): AnimalFilter {
  if (id === "tolly300") return TOLLY_OVER_300;
  if (id === "out") return { outOnly: true };
  return {};
}

export function renderAnimalPanel(state: GameState, activeFilter: AnimalFilterId): void {
  const list = document.getElementById("animal-list");
  const detail = document.getElementById("animal-detail");
  const title = document.getElementById("animal-detail-title");
  const body = document.getElementById("animal-detail-body");
  if (!list || !detail || !title || !body || !state.story) return;
  const animals = (state.story.animals ?? []).filter((animal) => animal.whereabouts !== "sold");
  const selected = new Set(state.story.selectedAnimalIds ?? []);
  const focused = animals.find((animal) => animal.id === state.story?.focusedAnimalId) ?? null;
  if (focused) {
    const copy = animalDetailCopy(focused);
    title.textContent = copy.title;
    body.textContent = copy.body;
    detail.hidden = false;
  } else {
    detail.hidden = true;
    title.textContent = "";
    body.textContent = "";
  }
  const shown = activeFilter === "all" ? animals : filterAnimals(animals, filterForPreset(activeFilter));
  list.replaceChildren();
  if (shown.length === 0) {
    const empty = document.createElement("li");
    empty.className = "animal-empty";
    empty.textContent = activeFilter === "out" ? "No animals are out." : "No animals match.";
    list.append(empty);
    return;
  }
  for (const animal of shown) {
    list.append(animalRow(animal, selected.has(animal.id)));
  }
}

function animalRow(animal: AnimalRecord, selected: boolean): HTMLLIElement {
  const row = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = selected ? "animal-row is-selected" : "animal-row";
  button.dataset.animalId = animal.id;
  button.textContent = animalListLine(animal);
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  row.append(button);
  return row;
}
