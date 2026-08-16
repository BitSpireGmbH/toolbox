import { describe, expect, it } from 'vitest';
import { TOOL_CATEGORIES, TOOL_SECTIONS, TOOLS } from './tools.registry';

describe('tools registry', () => {
  it('declares every category in exactly one section', () => {
    const declared = TOOL_SECTIONS.flatMap(section => section.categories);
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('derives TOOL_CATEGORIES from the section definitions', () => {
    expect(TOOL_CATEGORIES).toEqual(TOOL_SECTIONS.flatMap(section => [...section.categories]));
  });

  /**
   * The one invariant that matters: a tool whose section doesn't own its
   * category renders in neither, silently vanishing from the sidebar and the
   * landing page while its route keeps working.
   */
  it('puts every tool in a category its own section declares', () => {
    for (const tool of TOOLS) {
      const section = TOOL_SECTIONS.find(candidate => candidate.name === tool.section);
      expect(section, `${tool.title} has unknown section "${tool.section}"`).toBeDefined();
      expect(
        section?.categories,
        `${tool.title} is in section "${tool.section}" which does not declare "${tool.category}"`
      ).toContain(tool.category);
    }
  });

  it('keeps tool paths unique', () => {
    const paths = TOOLS.map(tool => tool.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  /**
   * Two tools sharing an icon are indistinguishable in the sidebar rail, which is icon-only
   * at its collapsed width - so the icon is the only thing telling them apart there.
   */
  it('gives every tool its own icon', () => {
    const byIcon = new Map<string, string[]>();
    for (const tool of TOOLS) {
      byIcon.set(tool.icon, [...(byIcon.get(tool.icon) ?? []), tool.title]);
    }

    const shared = [...byIcon.entries()].filter(([, titles]) => titles.length > 1);
    expect(
      shared,
      shared.map(([icon, titles]) => `"${icon}" is used by ${titles.join(' and ')}`).join('; ')
    ).toEqual([]);
  });

  it('reaches every tool from the section structure', () => {
    const reachable = TOOL_SECTIONS.flatMap(section =>
      section.categories.flatMap(category => TOOLS.filter(tool => tool.category === category))
    );
    expect(reachable).toHaveLength(TOOLS.length);
  });
});
