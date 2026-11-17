import { describe, expect, it } from "vitest";
import { processNoteContent } from "../src/modules/notes/content.js";
import { setupApp } from "./helpers.js";

const ctx = setupApp();

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("note content processing", () => {
  it("keeps editor formatting and strips anything executable", () => {
    const { content, contentText } = processNoteContent(
      [
        '<h2 style="text-align: center">Kick-off</h2>',
        "<p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s> <mark>hi</mark></p>",
        '<p><span style="color: #dc2626; position: fixed">red</span></p>',
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li></ul>',
        '<p><a href="javascript:alert(1)">bad</a> <a href="https://example.com" onclick="x()">good</a></p>',
        '<img src="x" onerror="alert(1)"><script>alert(1)</script><iframe src="https://evil"></iframe>',
        '<p onmouseover="alert(1)" style="background: url(javascript:alert(1))">tail</p>',
      ].join(""),
    );
    expect(content).toContain('<h2 style="text-align:center">Kick-off</h2>');
    expect(content).toContain("<strong>Bold</strong>");
    expect(content).toContain('<span style="color:#dc2626">red</span>');
    expect(content).toContain('data-checked="true"');
    expect(content).toContain('<input type="checkbox" checked');
    expect(content).toContain(
      'href="https://example.com" target="_blank" rel="noopener noreferrer nofollow"',
    );
    for (const forbidden of [
      "javascript:",
      "onerror",
      "onclick",
      "onmouseover",
      "<script",
      "<iframe",
      "<img",
      "position",
      "background",
    ]) {
      expect(content).not.toContain(forbidden);
    }
    expect(contentText).toContain("Kick-off\nBold it u s hi");
  });

  it("extracts mentions and uploaded images", () => {
    const user = "0123456789abcdef01234567";
    const image = "abcdefabcdefabcdefabcdef";
    const result = processNoteContent(
      `<p>Hi <span data-type="mention" data-id="${user}" data-label="Ada">@Ada</span></p><img src="/api/v1/notes/images/${image}">`,
    );
    expect(result.mentions).toEqual([user]);
    expect(result.images).toEqual([image]);
    expect(result.contentText).toBe("Hi @Ada");
  });
});

describe("notes API", () => {
  it("creates, lists, searches, filters and deletes notes", async () => {
    const { agent } = await ctx.login("DEVELOPER");
    const created = await agent.post("/api/v1/notes").send({
      title: "Weekly sync",
      content: "<p>Discuss the <strong>roadmap</strong></p>",
      tags: ["Meeting", "meeting", "call"],
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      title: "Weekly sync",
      visibility: "PRIVATE",
      tags: ["meeting", "call"],
      contentText: "Discuss the roadmap",
      canEdit: true,
    });
    await agent.post("/api/v1/notes").send({ title: "Groceries", tags: ["personal"] });

    const search = await agent.get("/api/v1/notes").query({ search: "roadmap" });
    expect(search.body.data.map((n: { title: string }) => n.title)).toEqual(["Weekly sync"]);
    expect(search.body.data[0].content).toBeUndefined();

    const byTag = await agent.get("/api/v1/notes").query({ tag: "personal" });
    expect(byTag.body.data.map((n: { title: string }) => n.title)).toEqual(["Groceries"]);
    expect((await agent.get("/api/v1/notes/tags")).body.data).toEqual([
      "call",
      "meeting",
      "personal",
    ]);

    const id = created.body.data._id;
    expect((await agent.delete(`/api/v1/notes/${id}`)).status).toBe(200);
    expect((await agent.get(`/api/v1/notes/${id}`)).status).toBe(404);
  });

  it("keeps private notes private and lets admins moderate only team notes", async () => {
    const author = await ctx.login("SALES");
    const other = await ctx.login("FINANCE");
    const admin = await ctx.login("ADMIN");
    const secret = (await author.agent.post("/api/v1/notes").send({ title: "Secret" })).body.data;
    const shared = (
      await author.agent.post("/api/v1/notes").send({ title: "Shared", visibility: "TEAM" })
    ).body.data;

    expect((await other.agent.get(`/api/v1/notes/${secret._id}`)).status).toBe(404);
    expect((await admin.agent.get(`/api/v1/notes/${secret._id}`)).status).toBe(404);
    const seen = await other.agent.get(`/api/v1/notes/${shared._id}`);
    expect(seen.body.data.canEdit).toBe(false);
    expect(
      (await other.agent.patch(`/api/v1/notes/${shared._id}`).send({ title: "x" })).status,
    ).toBe(403);

    const moderated = await admin.agent
      .patch(`/api/v1/notes/${shared._id}`)
      .send({ title: "Edited" });
    expect(moderated.status).toBe(200);
    expect(moderated.body.data.updatedBy.name).toBe("ADMIN User");
    const hide = await admin.agent
      .patch(`/api/v1/notes/${shared._id}`)
      .send({ visibility: "PRIVATE" });
    expect(hide.status).toBe(403);

    const search = await other.agent.get("/api/v1/search").query({ q: "Secret" });
    expect(search.body.data.some((r: { type: string }) => r.type === "note")).toBe(false);
    const found = await other.agent.get("/api/v1/search").query({ q: "Edited" });
    expect(found.body.data).toContainEqual(
      expect.objectContaining({ type: "note", title: "Edited" }),
    );
  });

  it("pins without counting as an edit", async () => {
    const { agent } = await ctx.login("DEVELOPER");
    const first = (await agent.post("/api/v1/notes").send({ title: "Pin first" })).body.data;
    await agent.post("/api/v1/notes").send({ title: "Pin second" });
    await agent.patch(`/api/v1/notes/${first._id}/pin`).send({ pinned: true });
    const list = await agent.get("/api/v1/notes").query({ search: "Pin " });
    expect(list.body.data[0]).toMatchObject({ title: "Pin first", pinned: true });
    expect(list.body.data[0].updatedAt).toBe(first.updatedAt);
  });

  it("refuses a save based on a stale copy", async () => {
    const { agent } = await ctx.login("DEVELOPER");
    const note = (await agent.post("/api/v1/notes").send({ title: "Draft" })).body.data;
    await agent
      .patch(`/api/v1/notes/${note._id}`)
      .send({ title: "First", baseUpdatedAt: note.updatedAt });
    const stale = await agent
      .patch(`/api/v1/notes/${note._id}`)
      .send({ title: "Second", baseUpdatedAt: note.updatedAt });
    expect(stale.status).toBe(409);
  });

  it("records versions and restores one", async () => {
    const { agent } = await ctx.login("DEVELOPER");
    const note = (await agent.post("/api/v1/notes").send({ title: "v1", content: "<p>one</p>" }))
      .body.data;
    await agent.patch(`/api/v1/notes/${note._id}`).send({ title: "v2", content: "<p>two</p>" });
    await agent.patch(`/api/v1/notes/${note._id}`).send({ tags: ["no-new-version"] });

    const versions = (await agent.get(`/api/v1/notes/${note._id}/versions`)).body.data;
    expect(versions).toHaveLength(1);
    const version = (await agent.get(`/api/v1/notes/${note._id}/versions/${versions[0]._id}`)).body
      .data;
    expect(version).toMatchObject({ title: "v1", content: "<p>one</p>" });

    const restored = await agent.post(
      `/api/v1/notes/${note._id}/versions/${versions[0]._id}/restore`,
    );
    expect(restored.body.data).toMatchObject({ title: "v1", content: "<p>one</p>" });
    expect((await agent.get(`/api/v1/notes/${note._id}/versions`)).body.data).toHaveLength(2);
  });

  it("notifies mentioned users once, and only when the note is shared", async () => {
    const author = await ctx.login("SALES");
    const mentioned = await ctx.login("DEVELOPER");
    const content = `<p>Over to <span data-type="mention" data-id="${mentioned.id}" data-label="Dev">@Dev</span></p>`;
    const note = (await author.agent.post("/api/v1/notes").send({ title: "Handoff", content })).body
      .data;

    const unread = async () =>
      (await mentioned.agent.get("/api/v1/notifications")).body.data.filter(
        (n: { type: string }) => n.type === "NOTE_MENTION",
      );
    expect(await unread()).toHaveLength(0);

    await author.agent.patch(`/api/v1/notes/${note._id}`).send({ visibility: "TEAM" });
    await author.agent
      .patch(`/api/v1/notes/${note._id}`)
      .send({ content: `${content}<p>more</p>` });
    const notifications = await unread();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ link: `/notes?note=${note._id}`, message: "Handoff" });
  });

  it("serves note images only to people who can see them, and exports a PDF", async () => {
    const author = await ctx.login("SALES");
    const other = await ctx.login("FINANCE");
    const upload = await author.agent
      .post("/api/v1/notes/images")
      .attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    const { src } = upload.body.data;

    const fake = await author.agent
      .post("/api/v1/notes/images")
      .attach("file", Buffer.from("<svg/>"), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(fake.status).toBe(400);

    const note = (
      await author.agent.post("/api/v1/notes").send({
        title: "With image",
        content: `<h2>Plan</h2><ul><li><p>Item</p></li></ul><img src="${src}">`,
      })
    ).body.data;
    expect((await author.agent.get(src)).headers["content-type"]).toBe("image/png");
    expect((await other.agent.get(src)).status).toBe(404);

    // Someone who cannot open the image cannot gain access by embedding its id.
    const steal = await other.agent
      .post("/api/v1/notes")
      .send({ title: "Steal", content: `<img src="${src}">`, visibility: "TEAM" });
    expect(steal.status).toBe(400);

    await author.agent.patch(`/api/v1/notes/${note._id}`).send({ visibility: "TEAM" });
    expect((await other.agent.get(src)).status).toBe(200);

    const pdf = await author.agent.get(`/api/v1/notes/${note._id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.headers["content-disposition"]).toContain("With image.pdf");
  });
});
