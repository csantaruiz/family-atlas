import type { HistoryEvent } from '../types'
import { historyEventHeroKey } from './historyEventImagery'

const WIKIPEDIA_BASE = 'https://en.wikipedia.org/wiki/'

const HISTORY_EVENT_WIKIPEDIA: Record<string, string> = {
  '1485|Tudor dynasty begins': `${WIKIPEDIA_BASE}Tudor_dynasty`,
  '1534|English Reformation': `${WIKIPEDIA_BASE}English_Reformation`,
  '1603|Union of the Crowns': `${WIKIPEDIA_BASE}Union_of_the_Crowns`,
  '1642|English Civil War begins': `${WIKIPEDIA_BASE}English_Civil_War`,
  '1660|The Restoration': `${WIKIPEDIA_BASE}Restoration_(England)`,
  '1707|Kingdom of Great Britain': `${WIKIPEDIA_BASE}Acts_of_Union_1707`,
  '1776|American independence': `${WIKIPEDIA_BASE}American_Revolution`,
  '1789|U.S. Constitution takes effect': `${WIKIPEDIA_BASE}Constitution_of_the_United_States`,
  '1810|Mexican War of Independence': `${WIKIPEDIA_BASE}Mexican_War_of_Independence`,
  '1821|Mexico becomes independent': `${WIKIPEDIA_BASE}Mexican_War_of_Independence#Consummation_of_Independence_(1821%E2%80%931835)`,
  '1845|The Great Famine': `${WIKIPEDIA_BASE}Great_Famine_(Ireland)`,
  '1846|Mexican–American War': `${WIKIPEDIA_BASE}Mexican%E2%80%93American_War`,
  '1848|Treaty of Guadalupe Hidalgo': `${WIKIPEDIA_BASE}Treaty_of_Guadalupe_Hidalgo`,
  '1861|American Civil War': `${WIKIPEDIA_BASE}American_Civil_War`,
  '1862|French intervention in Mexico': `${WIKIPEDIA_BASE}Second_French_intervention_in_Mexico`,
  '1876|Porfirian era begins': `${WIKIPEDIA_BASE}Porfiriato`,
  '1910|Mexican Revolution': `${WIKIPEDIA_BASE}Mexican_Revolution`,
  '1914|First World War': `${WIKIPEDIA_BASE}United_Kingdom_in_World_War_I`,
  '1917|Mexico’s Constitution of 1917': `${WIKIPEDIA_BASE}Constitution_of_Mexico`,
  '1917|United States enters WWI': `${WIKIPEDIA_BASE}American_entry_into_World_War_I`,
  '1929|Great Depression': `${WIKIPEDIA_BASE}Great_Depression_in_the_United_States`,
  '1939|Second World War begins': `${WIKIPEDIA_BASE}United_Kingdom_in_World_War_II`,
  '1941|United States enters WWII': `${WIKIPEDIA_BASE}Attack_on_Pearl_Harbor`,
  '1944|D-Day and the air war': `${WIKIPEDIA_BASE}Normandy_landings`,
  '1964|Civil Rights Act': `${WIKIPEDIA_BASE}Civil_Rights_Act_of_1964`,
  '1969|Apollo 11': `${WIKIPEDIA_BASE}Apollo_11`,
  '1989|World Wide Web proposed': `${WIKIPEDIA_BASE}World_Wide_Web`,
  '2001|September 11 attacks': `${WIKIPEDIA_BASE}September_11_attacks`,
  '2020|COVID-19 pandemic': `${WIKIPEDIA_BASE}COVID-19_pandemic`,
}

export function getHistoryEventWikipediaUrl(event: HistoryEvent): string | null {
  return HISTORY_EVENT_WIKIPEDIA[historyEventHeroKey(event)] ?? null
}
