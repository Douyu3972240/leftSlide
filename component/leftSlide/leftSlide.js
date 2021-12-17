Component({
    /**
     * 组件的属性列表
     */
    properties: {
        isShow: {
            // 当一个滑动展开时其他的就要收起来,false表示收起状态，true表示滑动展开状态
            type: Boolean,
            value: false
        },
        // 跳转的连接
        url: {
            type: String,
            value: ""
        },
        buttons: {
            /* 
            text:按钮显示的文字，
            eventName:事件名字，
            style:样式
            */
            type: Array,
            value: [{
                text: "redact",
                eventName: "edit",
                style: "background-color:#DAE2EA;color:#333;",
            }, {
                text: "delete",
                eventName: "del",
                style: "",
            }]
        },
        extra: {
            // 用于记录外部传进来的数据
            type: Object,
            value: {}
        }
    },
    lifetimes: {
        attached: function () {
            // 在组件实例进入页面节点树时执行
        },
        detached: function () {
            // 在组件实例被从页面节点树移除时执行
        },
        ready: function () {
            // 视图渲染完成
            this.init()
        },
    },
    /**
     * 组件的初始数据
     */
    data: {
        isUpdataPosition: true,  //用来表示是否更新手指最新的位置。在某些时候是不需要去更新手指的位置的
        startTimestamp: 0,   //手指开始触摸时的时间戳
        endTimestamp: 0,   //手指结束触摸时的时间戳，用结束时间减去开始时间得到这次触摸用了多长时间
        lastOffset: {
            // 记录上一次偏移的距离，右滑时就在这个偏移的基础上去减少偏移量
            x: 0,
            y: 0
        },
        isMoveFull: false,   //是否移动到最大值了，用于固定滑动后的位置
        listenTouch: true,   //是否监听手指滑动事件
        maxSlide: 0, //最大可以移动多少px
        mockSlotStyle: "",   //按钮的样式，主要用transform:translate去控制位置
        slotStyle: "",   //被组件嵌套的view样式，主要用transform:translate去控制位置
        position: {
            touchstart: {
                // 开始触摸点
                X: 0,
                Y: 0
            },
            touchend: {
                // 结束触摸点
                X: 0,
                Y: 0
            },

        }
    },
    /**
     * 组件的方法列表
     */
    methods: {
        init() {
            // 用于初始化，得到应该移动的距离和事假绑定。有时候事件是动态变化的，需要在初始化完成后调用该方法
            let _this = this
            let query = wx.createSelectorQuery().in(this);
            query.select('.btnList').boundingClientRect((rect) => {
                // 这里原本是想获得到每个按钮的宽高，后面改成了按钮组的view宽高
                // 这里需要循环去注册事件
                this.setData({
                    maxSlide: rect.width, //这里获得到x最大可以移动多少
                })
                for (let i in _this.data.buttons) {
                    _this[this.data.buttons[i].eventName] = function () {
                        // 这里是设置点击的时候位置还原
                        _this.setData({
                            isMoveFull: false,
                            slotStyle: `transform:translateX(0px);transition:all .3s;`,
                            mockSlotStyle: `transform:translateX(calc(100% + 1px);transition:all .3s;`
                        })
                        console.log("初始化事件:", _this.data.buttons[i].eventName)
                        _this.triggerEvent(_this.data.buttons[i].eventName, { extra: _this.data.extra })
                    }
                }
            }).exec();
        },
        checkStatusShow() {
            // 用来检查这个组件按钮的展示和隐藏状态
            if (this.data.isShow) {
                // 设置成展开状态
            } else {
                // 设置成隐藏状态
                this.setData({
                    isMoveFull: false,
                    slotStyle: `transform:translateX(0px);transition:all .3s;`,
                    mockSlotStyle: `transform:translateX(calc(100% + 1px));transition:all .3s;`,
                })
            }
        },
        navigator() {
            const url = this.data.url
            if (url) {
                // 点击后记得样式还原
                this.setData({
                    slotStyle: `transform:translateX(0px);transition:all .3s;`,
                    mockSlotStyle: `transform:translateX(calc(100% + 1px));transition:all .3s;`,
                })
                wx.navigateTo({
                    url
                })
            }
        },
        touchMoveingSetPostion(position, type) {
            let _this = this
            // let positions = position
            // let touchType = type
            // console.log("positions.x:", positions.x)

            // 这个方法是设置手指在移动过程中需要对应元素位置，使用前应该先调用getDistance方法
            // position,移动的距离 type 类型，1.手指开始 2.手指移动中 3.触摸被打断，如意外的来电弹窗等 4.触摸完成，一般指手指离开

            const inertance = 1.8    //定义一个惯性
            const weight = 3    //定义质量为3
            const speed = Math.abs(position.x) / (this.data.endTimestamp - this.data.startTimestamp)
            // 时间戳差值 * 质量 = 惯性，时间戳差值越小速度越快

            const ratio = 3 / 5
            const angleC = {
                X: this.data.position.touchend.X,
                Y: this.data.position.touchstart.Y
            }
            const maxAngle = this.getAngle(this.data.position.touchstart, this.data.position.touchend, angleC) > 18 ? false : true
            if (position.x > 0 && this.data.isMoveFull == false) {
                // 左滑,有距离并且没有完全左滑成功的时候才可以左滑
                if ((position.x >= Math.round(this.data.maxSlide * ratio) && (type == 3 || type == 4) || (weight * speed > inertance)) && maxAngle) {
                    // 根据以上两个条件的判断，要么是滑动距离超过按钮框的3/5，要么滑动时惯性大于inertance
                    // 如果手指移动的位置大于按钮组宽度的ratio了，并且手指离开了，那么就自动移动剩下的距离
                    // 在左滑完成的时候要往外面抛一个方法,direction 1.左滑完成 2.右滑完成
                    this.triggerEvent('slideDone', { direction: 1, extra: this.data.extra })
                    const slotStyle = `transform:translateX(-${_this.data.maxSlide}px);transition:all .3s;`
                    const mockSlotStyle = `transform:translateX(calc(100% - ${_this.data.maxSlide}px));transition:all .3s;`
                    _this.setData({
                        isMoveFull: true,
                        slotStyle,
                        mockSlotStyle
                    })
                } else if ((position.x < Math.round(this.data.maxSlide * ratio) && (type == 3 || type == 4)) || maxAngle == false) {
                    // 还原到开始状态
                    this.setData({
                        isUpdataPosition: false,
                        slotStyle: `transform:translateX(0px);transition:all .3s;`,
                        mockSlotStyle: `transform:translateX(calc(100% + 1px));transition:all .3s;`,
                        lastOffset: {
                            x: position.x * (-1),
                            y: 0
                        }
                    })
                } else if (type == 2 && maxAngle) {
                    this.setData({
                        slotStyle: `transform:translateX(-${position.x}px)`,
                        mockSlotStyle: `transform:translateX(calc(100% - ${position.x}px))`,
                        lastOffset: {
                            x: position.x * (-1),
                            y: 0
                        }
                    })
                }
            } else if (position.x < 0 && this.data.isMoveFull == true) {
                // 右滑，记得还原
                if ((Math.abs(position.x) >= Math.round(this.data.maxSlide * ratio) && (type == 3 || type == 4) || (weight * speed > inertance)) && maxAngle) {
                    // 还原到开始状态，也就是最右边，隐藏状态
                    this.setData({
                        isMoveFull: false,
                        slotStyle: `transform:translateX(0px);transition:all .3s;`,
                        mockSlotStyle: `transform:translateX(calc(100% + 1px));transition:all .3s;`,
                    })
                    this.triggerEvent('slideDone', { direction: 2, extra: this.data.extra })
                } else if ((Math.abs(position.x) < Math.round(this.data.maxSlide * ratio) && (type == 3 || type == 4)) || maxAngle == false) {
                    // 还原到展开状态，也就是用户手指滑动的距离不够
                    this.setData({
                        isUpdataPosition: false,
                        slotStyle: `transform:translateX(-${this.data.maxSlide}px);transition:all .3s;`,
                        mockSlotStyle: `transform:translateX(calc(100% - ${this.data.maxSlide}px));transition:all .3s;`,
                    })
                } else if (type == 2 && maxAngle) {
                    // 这里应该是用按钮组的宽度得到的一个x坐标 加上手指移动的距离
                    const offset = this.data.maxSlide * -1 + Math.abs(position.x)
                    this.setData({
                        slotStyle: `transform:translateX(${offset}px)`,
                        mockSlotStyle: `transform:translateX(calc(100% + ${offset}px))`,
                    })
                }
            }
        },
        getDistance(start, end) {
            // 计算得到开始触摸点和当触摸点的距离
            // console.log(`开始x:${start.X},结束:${end.X}`)
            return {
                x: (start.X - end.X),
                y: (start.Y - end.Y)
            }
        },
        getAngle(A1, A2, A3) {
            // 通过传入3个点，来得这3个点夹角的角度
            let A = A1
            let B = A2
            let C = A3
            let AB = Math.sqrt(Math.pow(A.X - B.X, 2) + Math.pow(A.Y - B.Y, 2));      // AB = √边长1²+边长2²
            let AC = Math.sqrt(Math.pow(A.X - C.X, 2) + Math.pow(A.Y - C.Y, 2));      // 同上
            let BC = Math.sqrt(Math.pow(B.X - C.X, 2) + Math.pow(B.Y - C.Y, 2));      // 同上
            let cosA = (Math.pow(AB, 2) + Math.pow(AC, 2) - Math.pow(BC, 2)) / (2 * AB * AC);
            let angleA = Math.round(Math.acos(cosA) * 180 / Math.PI);
            return angleA || 0
            // 得到angleA角度：45°
            /*
                AB      = 开根( (A.X-B.X)² + (A.Y-B.Y)² ）
                AC      =       A.X-C.X      A.Y-C.Y
                BC      =       B.X-C.X      B.Y-C.Y
                consA   = (AB²+AC²-BC²) / (2*AB*AC)
                angleA  = Math.acos(cosA)*180/Math.PI
            */
        },
        touchstart(e) {
            // console.log("开始触摸:", e)
            this.setData({
                // isShow: true,
                startTimestamp: new Date().getTime(),
                ['position.touchstart.X']: e.changedTouches[0].clientX,
                ['position.touchstart.Y']: e.changedTouches[0].clientY
            })
        },
        touchmove(e) {
            // console.log("触摸中:", e)
            this.setData({
                ['position.touchend.X']: e.changedTouches[0].clientX,
                ['position.touchend.Y']: e.changedTouches[0].clientY
            })
            // 移动中就要去计算开始点和当前点移动的距离
            if (this.data.isUpdataPosition) {
                this.touchMoveingSetPostion(this.getDistance(this.data.position.touchstart, this.data.position.touchend), 2)
            }
        },
        touchcancel(e) {
            // console.log("触摸被打断，如来电等:", e)
            this.setData({
                endTimestamp: new Date().getTime(),
                ['position.touchend.X']: e.changedTouches[0].clientX,
                ['position.touchend.Y']: e.changedTouches[0].clientY,
            })
            if (this.data.isUpdataPosition) {
                this.touchMoveingSetPostion(this.getDistance(this.data.position.touchstart, this.data.position.touchend), 3)
            }
            this.setData({
                isUpdataPosition: true
            })
        },
        touchend(e) {
            // console.log("触摸完成:", e)
            // if (this.data.listenTouch == false) {
            //     return false
            // }
            this.setData({
                endTimestamp: new Date().getTime(),
                ['position.touchend.X']: e.changedTouches[0].clientX,
                ['position.touchend.Y']: e.changedTouches[0].clientY
            })
            if (this.data.isUpdataPosition) {
                this.touchMoveingSetPostion(this.getDistance(this.data.position.touchstart, this.data.position.touchend), 4)
            }
            this.setData({
                isUpdataPosition: true
            })
        }
    }
})