import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
//import { URL } from 'url';
//console.log(URL);

async function load_json(file_name) {
  return JSON.parse(
    await fs.promises.readFile(
      new URL(file_name, import.meta.url)
    )
  );
}


/*
 * ルーティング
 */
const init = async function(config) {
  // 上記引数のconfigはで設定。

  // ファイルアップロードのためのミドルウェア
  // loginCheck,writePermissionCheckは済んでる前提
  const storage = multer.diskStorage({
    destination: function(req,file,cb) {
      const the_path = path.join(config.files.root,req.path);
      const p_path = path.dirname(the_path);
      cb(null,p_path);
    },
    filename: function (req,file,cb) {
      const the_path = path.join(config.files.root,req.path);
      const name = path.basename(the_path);
      cb(null,name);
    }
  });
  const upload = multer({storage: storage});

  const router = express.Router();

  // express.staticの前に置くことでディレクトリの
  // indexを表示できるようにするミドルウェア
  // ただし、下の方にあるloginCheckとreadPermissionCheckの
  // 後に置かれておりreq.session.uidとかが使える前提で
  // 書かれている
  const dirIndex = async function(req,res,next) {
    const the_path = config.files.root + req.path;
    const stats = await stat(the_path);
    if (!!stats && stats.isDirectory()) { // ここの判定はシンボリックリンクでもOKっぽい
      if (req.accepts(['html', 'json'])==='json') {
        const files = await readdir(the_path);
        res.json({files});
        return;
      } else {
        if (the_path.endsWith('/')) {
          const files = await readdir(the_path);
          files.unshift(parentDir);
          let c_path = path.join(config.server.mount_path,req.path);
          const baseUrl = config.server.mount_path;
          res.render('files/dir_index', {
            c_path, files, baseUrl,
            admin: req.session.admin,
            teacher: req.session.teacher,
            sa: req.session.sa
          });
          return;
        } else {
          const basename = path.basename(the_path);
          res.redirect('./'+basename+'/');
          return;
        }
      }
    }
    next();
  };
  const staticRouter = express.static(config.files.root);
  const parentDir = {
    name: '..',
    isDirectory: function() { return true; }
  };

  // パスを調べて非同期でStatsを返す。
  async function stat(path) {
    return new Promise((resolve,reject)=>{
      fs.stat(path,(err,stats)=>{
        if (err) {
          resolve(null);
          return;
        }
        resolve(stats);
      });
    });
  }

  // フォルダの中一覧を非同期でゲット
  // シンボリックリンクもリンク先の属性で
  // 取得したいのだが、ただのfs.readdirの
  // withFileTypes:trueではうまくいかなかったので
  // 以下のようにした。
  async function readdir(dir) {
    return new Promise((resolve,reject) => {
      fs.readdir(dir,{},async function(err,dirents) {
        if (err) {
          reject(err);
          return;
        }
        const files = [];
        for (let e of dirents) {
          if (e==='.uids')
            continue;
          const f = await stat(path.join(dir,e));
          f.name = e; // 無理矢理追加
          files.push(f);
        }
        resolve(files);
      });
    });
  }

  // ログインチェック AND uid取得
  function loginCheck(req,res,next) {
    let uid = null;
    if (!!req.session && !!req.session.uid)
      uid = req.session.uid;
    if (!uid) {
      // Web APIでの使用を優先してloginしていない
      // 時にloginページにリダイレクトさせるのはやめる
      //const loginURL = config.server.mount_path+'auth/login?return_path='+config.server.mount_path.slice(0,-1)+req.originalUrl;
      //res.redirect(loginURL);
      // アプリのTopページだけは認証されて
      // なくても表示されるようにしておく。
      if (req.path==='/') {
        next();
        return;
      }
console.log("GAHA: You are not authorized.");
      res.status(401).render('error.ejs',{
        msg: 'You are not authorized.',
        baseUrl: config.server.mount_path
      });
      return;
    }
    next();
  }

  // 読み出しのアクセス権チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.uidにuidが入っている前提で処理している。
  async function readPermissionCheck(req,res,next) {
    const uid = req.session.uid;
    const the_path = path.join(config.files.root,req.path);
    const stats = await fs.promises.stat(the_path);
    let uids_file;
    if (!!stats && stats.isDirectory()) {
      uids_file = path.join(the_path,'.uids');
    } else {
      const parent = path.dirname(the_path);
      uids_file = path.join(parent,'.uids');
    }
    uids_file='file://'+uids_file;
    let uids;
    try {
      uids = await load_json(uids_file);
    } catch(e) {
console.log("GAHA: Can not read the .uids file. "+uids_file);
      res.status(403).render('error.ejs',{
        msg: 'You do not have permission.',
        baseUrl: config.server.mount_path
      });
      return;
    }
      
    for (const u of uids.read) {
      if (u === uid) {
        next();
        return;
      } else if (u === 'any authorized users') {
        next();
        return;
      }
    }
console.log("GAHA: You do not have permission.1");
    res.status(403).render('error.ejs',{
      msg: 'You do not have permission.',
      baseUrl: config.server.mount_path
    });
    return;
  }

  // 書き込みのアクセス権チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.uidにuidが入っている前提で処理している。
  // それから、今の所簡単のためにputメソッドで既存のファイル
  // を更新する用途のみを想定した内容になっている。
  async function writePermissionCheck(req,res,next) {
    const uid = req.session.uid;
    const the_path = path.join(config.files.root,req.path);
    const stats = await fs.promises.stat(the_path);
    let uids_file;
    if (!!stats && stats.isFile()) {
      const parent = path.dirname(the_path);
      uids_file = path.join(parent,'.uids');
    } else {
console.log("GAHA: You do not have permission.2");
      res.status(403).render('error.ejs',{
        msg: 'You do not have permission.',
        baseUrl: config.server.mount_path
      });
      return;
    }
    let uids;
    try {
      uids = await load_json(uids_file);
    } catch(e) {
console.log("GAHA: Can not read the .uids file.2 "+uids_file);
      res.status(403).render('error.ejs',{
        msg: 'You do not have permission.',
        baseUrl: config.server.mount_path
      });
      return;
    }
      
    for (const u of uids.write) {
      if (u === uid) {
        next();
        return;
      } else if (u === 'any authorized users') {
        next();
        return;
      }
    }
console.log("GAHA: You do not have permission.4");
    res.status(403).render('error.ejs',{
      msg: 'You do not have permission.',
      baseUrl: config.server.mount_path
    });
    return;
  }

  router.get('/',loginCheck,(req,res,next) => {
    res.render('top',{
      uid: req.session.uid,
    });
  });
  router.get('/*',loginCheck,
             readPermissionCheck,
             dirIndex,
             staticRouter);
  router.put('/*',loginCheck,
             writePermissionCheck,
             upload.single('file'),
             (req,res)=>{
               const path = req.file.path.replace(/\\/g,"/");
               if (path)
                 res.status(200).send('ok');
               else
                 res.states(500).send('error');
             });

  return router;
};

export default init;
