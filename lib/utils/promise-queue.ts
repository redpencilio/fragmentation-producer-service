// Based on https://medium.com/@karenmarkosyan/how-to-manage-promises-into-dynamic-queue-with-vanilla-javascript-9d0d1f8d4df5

export default class PromiseQueue<T> {
  promises: any[] = [];
  runningPromise: boolean = false;

  push(promise: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.promises.push({
        promise,
        resolve,
        reject,
      });
      this.pop();
    });
  }

  pop() {
    if (this.runningPromise || !this.promises.length) {
      return;
    }
    const { promise, resolve, reject } = this.promises.shift();
    this.runningPromise = true;
    promise()
      .then((res: any) => {
        this.runningPromise = false;
        resolve(res);
        this.pop();
      })
      .catch((err: any) => {
        this.runningPromise = false;
        reject(err);
        this.pop();
      });
  }
}
