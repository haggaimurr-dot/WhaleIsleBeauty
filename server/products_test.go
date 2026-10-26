package main

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

// 化妆品清单，用例和前端 mock.products.test.ts 对齐

var testProduct = Product{Category: "base", Brand: " 植村秀 ", Name: "小方瓶粉底液", Note: " "}

func TestProductsForCustomers(t *testing.T) {
	a, _ := newTestApp(t)
	ctx := context.Background()
	list := must(a.Products(ctx, ""))
	seen := map[string]bool{}
	last := -1
	for _, p := range list {
		i := productOrder(p.Category)
		if i < last {
			t.Fatalf("not in category order: %s after %d", p.Category, last)
		}
		last = i
		seen[p.Category] = true
	}
	if len(seen) != len(productCategories) {
		t.Fatalf("every category has seed data, got %v", seen)
	}
	for _, p := range must(a.Products(ctx, "eye")) {
		if p.Category != "eye" {
			t.Fatalf("filter: %+v", p)
		}
	}
}

func TestProductsOwner(t *testing.T) {
	a, _ := newTestApp(t)
	ctx, owner, alice := context.Background(), user(t, a, ownerOpenID), user(t, a, "o-alice")

	_, err := a.CreateProduct(ctx, alice, testProduct)
	wantCode(t, err, "FORBIDDEN")

	p := must(a.CreateProduct(ctx, owner, testProduct))
	if p.Brand != "植村秀" || p.Note != "" {
		t.Fatalf("cleaned %+v", p)
	}
	base := must(a.Products(ctx, "base"))
	if base[len(base)-1].ID != p.ID {
		t.Fatal("new product goes last in its category")
	}
	all := must(a.Products(ctx, ""))
	if all[len(all)-1].Category != "remover" {
		t.Fatal("still inside the base section")
	}

	lip := must(a.Products(ctx, "lip"))[0]
	upd := must(a.UpdateProduct(ctx, owner, lip.ID, Product{Category: "eye", Brand: lip.Brand, Name: "改个名", Note: "每人一支唇刷"}))
	if upd.ID != lip.ID || upd.Category != "eye" || upd.Name != "改个名" {
		t.Fatalf("updated %+v", upd)
	}
	for _, x := range must(a.Products(ctx, "lip")) {
		if x.ID == lip.ID {
			t.Fatal("moved out of lip")
		}
	}

	bad := testProduct
	bad.Brand = " "
	_, err = a.CreateProduct(ctx, owner, bad)
	wantMsg(t, err, "品牌还没填")
	bad = testProduct
	bad.Category = "hair"
	_, err = a.CreateProduct(ctx, owner, bad)
	wantMsg(t, err, "还没选类别")
	_, err = a.UpdateProduct(ctx, owner, "nope", testProduct)
	wantCode(t, err, "NOT_FOUND")

	for _, x := range must(a.Products(ctx, "")) {
		if err := a.DeleteProduct(ctx, owner, x.ID); err != nil {
			t.Fatal(err)
		}
	}
	if got := must(a.Products(ctx, "")); len(got) != 0 {
		t.Fatalf("all deleted, got %d", len(got))
	}
	wantCode(t, a.DeleteProduct(ctx, owner, "nope"), "NOT_FOUND")
}

func TestValidateProduct(t *testing.T) {
	ok := cleanProduct(testProduct)
	if msg := validateProduct(ok); msg != "" {
		t.Fatal(msg)
	}
	cases := map[string]Product{
		"名称还没填":      {Category: "base", Brand: "a"},
		"说明最多 30 个字": {Category: "base", Brand: "a", Name: "b", Note: strings.Repeat("字", 31)},
		"品牌最多 20 个字": {Category: "base", Brand: strings.Repeat("字", 21), Name: "b"},
	}
	for want, p := range cases {
		if got := validateProduct(cleanProduct(p)); got != want {
			t.Fatalf("want %q got %q", want, got)
		}
	}
}

func TestProductsHTTP(t *testing.T) {
	a, _ := newTestApp(t)
	h := a.Routes()
	// 公开资料，不带 openid 也能看
	if code, _, body := do(t, h, "GET", "/v1/products?category=eye", "", ""); code != http.StatusOK || !strings.Contains(body, `"category":"eye"`) {
		t.Fatalf("list %d %s", code, body)
	}
	code, m, body := do(t, h, "POST", "/v1/owner/products", ownerOpenID, `{"category":"lip","brand":"迪奥","name":"变色唇膏"}`)
	if code != http.StatusOK || strings.Contains(body, `"note"`) {
		t.Fatalf("create %d %s", code, body)
	}
	id, _ := m["id"].(string)
	if code, _, body := do(t, h, "PUT", "/v1/owner/products/"+id, ownerOpenID, `{"category":"lip","brand":"迪奥","name":"变色唇膏","note":"会随唇温变色"}`); code != http.StatusOK || !strings.Contains(body, "随唇温") {
		t.Fatalf("update %d %s", code, body)
	}
	if code, _, _ := do(t, h, "DELETE", "/v1/owner/products/"+id, "o-alice", ""); code != http.StatusForbidden {
		t.Fatalf("customer delete %d", code)
	}
	if code, _, body := do(t, h, "DELETE", "/v1/owner/products/"+id, ownerOpenID, ""); code != http.StatusOK {
		t.Fatalf("delete %d %s", code, body)
	}
}
