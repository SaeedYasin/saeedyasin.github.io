import http from "./http";

export class Posts {
  message = "Hello World Posts";
  show = false;
  postBody = "";

  onClick = () => {
    this.show = !this.show;
  };

  activate = (params) => {
    const { id } = params;
    console.log("posts got", id);

    http
      .get(
        "https://raw.githubusercontent.com/SaeedYasin/saeedyasin.github.io/main/src/app.html"
      )
      .then((data) => {
        console.log(data.data);
        this.postBody = "<h1>Hellloooooo</h1>";
      });
  };
}
