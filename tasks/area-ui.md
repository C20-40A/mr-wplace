距離計測 エリア管理
のbuttonのUIの位置を変更してほしい。

画面の左上に次のような要素がある

<div class="absolute top-2 left-2 z-30 flex flex-col gap-3"><!--[--><button class="btn btn-sm btn-circle" title="Info"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3.5"><path d="M480-680q-33 0-56.5-23.5T400-760q0-33 23.5-56.5T480-840q33 0 56.5 23.5T560-760q0 33-23.5 56.5T480-680Zm-60 560v-480h120v480H420Z"></path></svg><!----></button><!--]--> <div class="flex flex-col gap-1 max-sm:hidden"><button title="Zoom in" class="btn btn-sm btn-circle">+</button> <button title="Zoom out" class="btn btn-sm btn-circle">-</button></div> <!--[!--><!--]--> <!--[!--><!--]--> <!--[--><button class="btn btn-sm btn-circle not-pwa:hidden" title="Refresh"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3"><path d=".........."></path></svg><!----></button><!--]--></div>

この要素のラストに追加してほしい
divのラストね。　Refresh　ボタンの後ろ
ただし、titleは英語だが、これは別の言語になる場合があるため、あまりselectorには向かない。やるなら、多言語selectorにする必要がある。
