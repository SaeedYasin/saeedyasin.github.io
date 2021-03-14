"use strict";

import { inject, PLATFORM } from "aurelia-framework";
import { EventAggregator } from "aurelia-event-aggregator";
import { Router } from "aurelia-router";

@inject(EventAggregator, Router)
export class App {
  constructor(EventAggregator, Router) {
    this.ea = EventAggregator;
    this.router = Router;

    this.navItems = {
      current: "Home",
      list: [
        {
          name: "Home",
          route: "home",
        },
        {
          name: "Posts",
          route: "posts",
        },
      ],
    };
  }

  configureRouter(config, router) {
    this.router = router;
    config.title = "SYBlog";

    config.map([
      {
        route: ["", "home"],
        name: "home",
        moduleId: PLATFORM.moduleName("home/index"),
        title: "Home",
        nav: true,
      },
      {
        route: "posts/:id?",
        name: "posts",
        moduleId: PLATFORM.moduleName("posts/index"),
        title: "Posts",
        nav: true,
        href: "#/posts/1",
      },
    ]);
  }
}
